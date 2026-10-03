import { jsPDF } from "jspdf";
import type { AnalyzeResult, InterviewReport } from "@/lib/types";

const READY_LABEL: Record<InterviewReport["readiness"], string> = {
  not_ready: "Not Ready",
  needs_preparation: "Needs Preparation",
  interview_ready: "Interview Ready",
  strong_candidate: "Strong Candidate",
};

const LEVEL_LABEL: Record<string, string> = {
  screening: "Level 1 · Screening",
  competency: "Level 2 · Competency",
  deep_dive: "Level 3 · Deep-Dive",
};

function wrap(doc: jsPDF, text: string, x: number, y: number, maxW: number, lineH = 5): number {
  const lines = doc.splitTextToSize(text || "", maxW) as string[];
  for (const line of lines) {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineH;
  }
  return y;
}

function heading(doc: jsPDF, title: string, y: number): number {
  if (y > 270) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y + 7;
}

function bullets(doc: jsPDF, items: string[], y: number): number {
  for (const item of items || []) {
    y = wrap(doc, `• ${item}`, 16, y, 180);
    y += 1;
  }
  return y + 2;
}

export function downloadInterviewReportPdf(
  report: InterviewReport,
  analysis: AnalyzeResult & { jdText?: string; resumeText?: string },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const role = analysis.role?.title || "Role";
  const date = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Interview Accelerator — Performance Report", 14, 20);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80);
  let y = wrap(doc, `Role: ${role}  ·  ${date}  ·  EDXSO Assignment 3`, 14, 28, 180);
  doc.setTextColor(0);
  y += 4;

  y = heading(doc, "Overall", y);
  y = wrap(
    doc,
    `Score: ${report.overallScore}/100   |   Readiness: ${READY_LABEL[report.readiness]}`,
    14,
    y,
    180,
  );
  y = wrap(doc, report.readinessRationale || "", 14, y + 1, 180);
  y += 3;

  y = heading(doc, "Job fit (pre-interview)", y);
  y = wrap(
    doc,
    `${analysis.jobFit.score}% — ${analysis.jobFit.label}. ${analysis.jobFit.summary || ""}`,
    14,
    y,
    180,
  );
  y += 3;

  y = heading(doc, "Competency scores", y);
  const comps = report.competencies || ({} as InterviewReport["competencies"]);
  for (const [k, v] of Object.entries(comps)) {
    const label = k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
    y = wrap(doc, `${label}: ${v}/100`, 14, y, 180);
  }
  y += 3;

  y = heading(doc, "Strengths", y);
  y = bullets(doc, report.strengths || [], y);

  y = heading(doc, "Weaknesses", y);
  y = bullets(doc, report.weaknesses || [], y);

  y = heading(doc, "Preparation gaps", y);
  for (const g of report.preparationGaps || []) {
    y = wrap(doc, `Priority ${g.priority}: ${g.topic}`, 14, y, 180);
    y = bullets(doc, g.review || [], y);
  }
  if (report.prepPlanSummary) {
    y = wrap(doc, report.prepPlanSummary, 14, y, 180);
    y += 2;
  }

  y = heading(doc, "Question-level feedback", y);
  for (const q of report.questionFeedback || []) {
    y = wrap(doc, `${LEVEL_LABEL[q.level] || q.level}${typeof q.score === "number" ? ` · ${q.score}/100` : ""}`, 14, y, 180);
    y = wrap(doc, `Q: ${q.question}`, 14, y, 180);
    y = wrap(doc, `A: ${q.answer}`, 14, y, 180);
    if (q.assessment) y = wrap(doc, `Assessment: ${q.assessment}`, 14, y, 180);
    if (q.whatWasGood?.length) {
      y = wrap(doc, "What was good:", 14, y, 180);
      y = bullets(doc, q.whatWasGood, y);
    }
    if (q.whatCouldBeBetter?.length) {
      y = wrap(doc, "What could be better:", 14, y, 180);
      y = bullets(doc, q.whatCouldBeBetter, y);
    }
    if (q.idealDirection) y = wrap(doc, `Ideal direction: ${q.idealDirection}`, 14, y, 180);
    y += 4;
  }

  const safeRole = role.replace(/[^\w\-]+/g, "_").slice(0, 40);
  doc.save(`interview-report-${safeRole}-${Date.now()}.pdf`);
}
