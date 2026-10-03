import { NextRequest, NextResponse } from "next/server";
import { clip, extractTextFromFile } from "@/lib/extract";
import { chatJson } from "@/lib/llm";
import type { AnalyzeResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    let jd = String(form.get("jdText") || "").trim();
    let resume = String(form.get("resumeText") || "").trim();
    const jdFile = form.get("jdFile");
    const resumeFile = form.get("resumeFile");

    if (jdFile instanceof File && jdFile.size > 0) {
      jd = await extractTextFromFile(jdFile);
    }
    if (resumeFile instanceof File && resumeFile.size > 0) {
      resume = await extractTextFromFile(resumeFile);
    }

    if (jd.length < 40 || resume.length < 40) {
      return NextResponse.json(
        { error: "Provide a substantial Job Description and Resume (paste or upload)." },
        { status: 400 },
      );
    }

    const system = `You are an expert career coach and technical interviewer.
Analyze a Job Description and Resume for an interview-prep product.
Return STRICT JSON matching this schema:
{
  "role": {
    "title": string,
    "responsibilities": string[],
    "requiredSkills": string[],
    "preferredSkills": string[],
    "technicalCompetencies": string[],
    "behaviouralCompetencies": string[],
    "experienceExpectations": string,
    "keywords": string[],
    "concepts": string[],
    "qualifications": string[]
  },
  "candidate": {
    "keySkills": string[],
    "relevantExperience": string[],
    "relevantProjects": string[],
    "achievements": string[],
    "strengths": string[],
    "missingSkills": string[],
    "weakAreas": string[],
    "claimsToProbe": string[],
    "prepAreas": string[]
  },
  "jobFit": {
    "score": number (0-100),
    "label": string,
    "strongMatch": string[],
    "partialMatch": string[],
    "missingWeak": string[],
    "summary": string
  }
}
Rules:
- Base every claim on the provided texts only. Do not invent employers/projects.
- claimsToProbe = resume claims that deserve interview follow-up (metrics, ownership, buzzwords).
- jobFit.score methodology: skill coverage + project relevance + experience signal (explain briefly in summary).
- Keep arrays concise (max 8 items each).`;

    const user = `JOB DESCRIPTION:\n${clip(jd)}\n\nRESUME:\n${clip(resume)}`;
    const result = await chatJson<AnalyzeResult>(system, user);

    if (!result?.role?.title || !result?.jobFit) {
      return NextResponse.json({ error: "Analysis failed to produce structured output." }, { status: 502 });
    }

    result.jobFit.score = Math.max(0, Math.min(100, Number(result.jobFit.score) || 0));

    return NextResponse.json({
      ...result,
      jdText: jd,
      resumeText: resume,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Analyze failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
