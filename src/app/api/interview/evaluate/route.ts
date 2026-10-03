import { NextRequest, NextResponse } from "next/server";
import { chatJson } from "@/lib/llm";
import type { AnalyzeResult, InterviewReport, InterviewTurn } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const analysis = body.analysis as AnalyzeResult;
    const turns = (body.turns || []) as InterviewTurn[];

    if (!turns.length) {
      return NextResponse.json({ error: "No interview turns to evaluate" }, { status: 400 });
    }

    const system = `You are a rigorous interview evaluator.
Given JD/resume analysis and the full Q&A transcript, produce a detailed report.
Return STRICT JSON:
{
  "overallScore": number 0-100,
  "competencies": {
    "roleFit": number,
    "technicalKnowledge": number,
    "problemSolving": number,
    "communication": number,
    "confidence": number,
    "depthOfUnderstanding": number,
    "behaviouralFit": number
  },
  "questionFeedback": [
    {
      "id": string,
      "level": string,
      "question": string,
      "answer": string,
      "assessment": string,
      "whatWasGood": string[],
      "whatCouldBeBetter": string[],
      "idealDirection": string,
      "score": number
    }
  ],
  "strengths": string[],
  "weaknesses": string[],
  "preparationGaps": [
    { "priority": number, "topic": string, "review": string[] }
  ],
  "readiness": "not_ready" | "needs_preparation" | "interview_ready" | "strong_candidate",
  "readinessRationale": string,
  "prepPlanSummary": string
}
Rules:
- Feedback must be specific and actionable (no vague "improve communication").
- Base evaluation on actual answers vs JD needs.
- preparationGaps: top 3 priorities with concrete review bullets.
- readiness thresholds roughly: <50 not_ready, 50-64 needs_preparation, 65-79 interview_ready, 80+ strong_candidate (adjust with JD fit).
- Include feedback for each turn (reuse ids/questions/answers provided).`;

    const user = `ANALYSIS: ${JSON.stringify(analysis)}
TRANSCRIPT: ${JSON.stringify(turns)}`;

    const report = await chatJson<InterviewReport>(system, user);

    // Ensure turn content preserved
    report.questionFeedback = (report.questionFeedback || []).map((f, i) => ({
      ...turns[i],
      ...f,
      id: turns[i]?.id || f.id,
      question: turns[i]?.question || f.question,
      answer: turns[i]?.answer || f.answer,
      level: turns[i]?.level || f.level,
    }));

    report.overallScore = Math.max(0, Math.min(100, Number(report.overallScore) || 0));
    return NextResponse.json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Evaluate failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
