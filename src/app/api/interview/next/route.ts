import { NextRequest, NextResponse } from "next/server";
import { chatJson } from "@/lib/llm";
import type { AnalyzeResult, InterviewLevel, InterviewTurn, NextQuestionResponse } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const LEVEL_ORDER: InterviewLevel[] = ["screening", "competency", "deep_dive"];
const PER_LEVEL = 3; // 3 questions per level => 9 total (+ adaptive follow-ups count toward level)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const analysis = body.analysis as AnalyzeResult;
    const turns = (body.turns || []) as InterviewTurn[];
    const jdText = String(body.jdText || "").slice(0, 8000);
    const resumeText = String(body.resumeText || "").slice(0, 8000);

    if (!analysis?.role || !analysis?.candidate) {
      return NextResponse.json({ error: "Missing analysis context" }, { status: 400 });
    }

    const count = turns.length;
    if (count >= 9) {
      return NextResponse.json({
        level: "deep_dive",
        question: "",
        done: true,
        reason: "Interview complete",
        difficulty: "same",
      } satisfies NextQuestionResponse);
    }

    const level: InterviewLevel =
      count < PER_LEVEL ? "screening" : count < PER_LEVEL * 2 ? "competency" : "deep_dive";

    const last = turns[turns.length - 1];
    const history = turns
      .slice(-6)
      .map((t, i) => `Q${i + 1} [${t.level}]: ${t.question}\nA: ${t.answer}`)
      .join("\n\n");

    const system = `You are a sharp, fair human interviewer running a personalised interview.
You MUST ask questions grounded in THIS candidate's resume + THIS JD.
Never ask generic "Tell me about yourself" unless you personalise it with a resume fact.
Dynamic rule: next question MUST react to the candidate's previous answer when one exists
(challenge vagueness, ask why/how, probe metrics, introduce a scenario).
Return STRICT JSON:
{
  "level": "${level}",
  "question": string,
  "done": false,
  "difficulty": "easier" | "same" | "harder",
  "reason": string
}
Level goals:
- screening: motivation, resume ownership, role fit, communication, career goals
- competency: job-specific technical/behavioural competencies, problem solving, projects
- deep_dive: challenge claims, technical depth, tradeoffs, edge cases, inconsistencies
Adapt difficulty: if last answer was strong → harder; weak/vague → clarify fundamentals then probe.`;

    const user = `TARGET LEVEL: ${level} (question ${count + 1} of 9)
ROLE ANALYSIS: ${JSON.stringify(analysis.role)}
CANDIDATE ANALYSIS: ${JSON.stringify(analysis.candidate)}
JOB FIT: ${JSON.stringify(analysis.jobFit)}
CLAIMS TO PROBE: ${JSON.stringify(analysis.candidate.claimsToProbe || [])}

JD (excerpt):
${jdText.slice(0, 3500)}

RESUME (excerpt):
${resumeText.slice(0, 3500)}

PREVIOUS TURNS:
${history || "(none — ask a personalised screening opener referencing a specific resume project/experience)"}

LAST ANSWER TO REACT TO:
${last ? last.answer : "(none)"}`;

    const result = await chatJson<NextQuestionResponse>(system, user);
    result.level = level;
    result.done = false;
    if (!result.question?.trim()) {
      result.question = personalisedFallback(analysis, level, count);
    }
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Next question failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function personalisedFallback(analysis: AnalyzeResult, level: InterviewLevel, n: number): string {
  const project = analysis.candidate.relevantProjects[0] || analysis.candidate.relevantExperience[0] || "your recent work";
  const skill = analysis.role.requiredSkills[0] || "this role's core skills";
  if (level === "screening") {
    return `I noticed ${project} on your resume. What problem did it solve, and what was your specific contribution?`;
  }
  if (level === "competency") {
    return `For a ${analysis.role.title} role, how have you applied ${skill} in a real project? Walk me through a concrete example.`;
  }
  return `You mentioned impact around ${project}. How did you measure success, and what would you do differently if a key assumption failed? (Q${n + 1})`;
}
