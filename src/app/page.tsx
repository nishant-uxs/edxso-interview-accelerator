"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, List, Pill, Shell, Stepper } from "@/components/ui";
import type {
  AnalyzeResult,
  InterviewLevel,
  InterviewReport,
  InterviewTurn,
  NextQuestionResponse,
  Readiness,
} from "@/lib/types";
import { analyzeSpeechMeta, getRecognition, speak, stopSpeaking } from "@/lib/voice";

type Step = 0 | 1 | 2 | 3 | 4;

const LEVEL_LABEL: Record<InterviewLevel, string> = {
  screening: "Level 1 · Screening",
  competency: "Level 2 · Competency",
  deep_dive: "Level 3 · Deep-Dive",
};

const READY: Record<Readiness, { label: string; tone: "bad" | "warn" | "good" | "neutral"; emoji: string }> = {
  not_ready: { label: "Not Ready", tone: "bad", emoji: "🔴" },
  needs_preparation: { label: "Needs Preparation", tone: "warn", emoji: "🟠" },
  interview_ready: { label: "Interview Ready", tone: "neutral", emoji: "🟡" },
  strong_candidate: { label: "Strong Candidate", tone: "good", emoji: "🟢" },
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const [step, setStep] = useState<Step>(0);
  const [jdText, setJdText] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<(AnalyzeResult & { jdText: string; resumeText: string }) | null>(null);
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [currentQ, setCurrentQ] = useState("");
  const [currentLevel, setCurrentLevel] = useState<InterviewLevel>("screening");
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [speechMeta, setSpeechMeta] = useState<{ fillers: number; wpm: number; wordCount: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recogRef = useRef<ReturnType<typeof getRecognition>>(null);
  const listenStarted = useRef<number>(0);

  const progress = useMemo(() => Math.min(100, Math.round((turns.length / 9) * 100)), [turns.length]);

  useEffect(() => {
    return () => {
      stopSpeaking();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recogRef.current?.stop();
    };
  }, []);

  async function runAnalyze() {
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("jdText", jdText);
      form.set("resumeText", resumeText);
      if (jdFile) form.set("jdFile", jdFile);
      if (resumeFile) form.set("resumeFile", resumeFile);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analyze failed");
      setAnalysis(data);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setBusy(false);
    }
  }

  const fetchNext = useCallback(
    async (nextTurns: InterviewTurn[]) => {
      if (!analysis) return;
      setBusy(true);
      setError("");
      try {
        const res = await fetch("/api/interview/next", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis,
            turns: nextTurns,
            jdText: analysis.jdText,
            resumeText: analysis.resumeText,
          }),
        });
        const data = (await res.json()) as NextQuestionResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || "Could not get next question");
        if (data.done) {
          await finishInterview(nextTurns);
          return;
        }
        setCurrentLevel(data.level);
        setCurrentQ(data.question);
        setAnswer("");
        setSpeaking(true);
        speak(data.question, () => setSpeaking(false));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Interview error");
      } finally {
        setBusy(false);
      }
    },
    [analysis],
  );

  async function startInterview() {
    setTurns([]);
    setReport(null);
    setStep(3);
    await fetchNext([]);
  }

  async function submitAnswer(text?: string) {
    const finalAnswer = (text ?? answer).trim();
    if (!finalAnswer || !currentQ) return;
    stopSpeaking();
    const turn: InterviewTurn = {
      id: uid(),
      level: currentLevel,
      question: currentQ,
      answer: finalAnswer,
    };
    const nextTurns = [...turns, turn];
    setTurns(nextTurns);
    setAnswer("");
    if (nextTurns.length >= 9) {
      await finishInterview(nextTurns);
    } else {
      await fetchNext(nextTurns);
    }
  }

  async function finishInterview(finalTurns: InterviewTurn[]) {
    if (!analysis) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, turns: finalTurns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Evaluation failed");
      setReport(data);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleListen() {
    if (listening) {
      recogRef.current?.stop();
      setListening(false);
      return;
    }
    const recog = getRecognition();
    if (!recog) {
      setError("Speech recognition not supported in this browser. Use Chrome, or type your answer.");
      return;
    }
    recogRef.current = recog;
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = "en-IN";
    let transcript = "";
    listenStarted.current = Date.now();
    recog.onresult = (ev) => {
      let interim = "";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const results = ev.results as any;
      for (let i = 0; i < results.length; i++) {
        const t = results[i][0].transcript;
        if (results[i].isFinal) transcript += t + " ";
        else interim += t;
      }
      setAnswer((transcript + interim).trim());
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => {
      setListening(false);
      const meta = analyzeSpeechMeta(answer || transcript, Date.now() - listenStarted.current);
      setSpeechMeta(meta);
    };
    recog.start();
    setListening(true);
  }

  async function toggleVideo() {
    if (videoOn) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
      setVideoOn(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setVideoOn(true);
    } catch {
      setError("Camera permission denied or unavailable. Voice interview still works.");
    }
  }

  return (
    <Shell>
      <Stepper step={step} />
      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h2 className="display text-2xl">Job Description</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">Paste JD text or upload a file (txt/pdf/docx).</p>
            <textarea
              className="mb-3 h-48 w-full rounded-xl border border-[var(--line)] bg-white/80 p-3 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Paste the full job description…"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
            <input type="file" accept=".txt,.md,.pdf,.docx,text/*" onChange={(e) => setJdFile(e.target.files?.[0] || null)} />
          </Card>
          <Card>
            <h2 className="display text-2xl">Resume</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">Paste resume text or upload a file.</p>
            <textarea
              className="mb-3 h-48 w-full rounded-xl border border-[var(--line)] bg-white/80 p-3 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Paste your resume…"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
            />
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx,text/*"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
          </Card>
          <div className="md:col-span-2 flex justify-end">
            <Button onClick={runAnalyze} disabled={busy}>
              {busy ? "Analysing…" : "Start Analysis"}
            </Button>
          </div>
        </div>
      )}

      {step === 1 && analysis && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="display text-3xl">{analysis.role.title}</h2>
              <Pill tone="good">Role analysis</Pill>
            </div>
            <p className="mt-2 text-sm text-[var(--muted)]">{analysis.role.experienceExpectations}</p>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="mb-2 font-semibold">Required skills</h3>
              <List items={analysis.role.requiredSkills} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Preferred skills</h3>
              <List items={analysis.role.preferredSkills} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Technical competencies</h3>
              <List items={analysis.role.technicalCompetencies} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Behavioural competencies</h3>
              <List items={analysis.role.behaviouralCompetencies} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Responsibilities</h3>
              <List items={analysis.role.responsibilities} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Keywords & concepts</h3>
              <List items={[...analysis.role.keywords, ...analysis.role.concepts].slice(0, 10)} />
            </Card>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => setStep(2)}>See candidate fit</Button>
          </div>
        </div>
      )}

      {step === 2 && analysis && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Your job fit</p>
                <p className="display text-5xl text-[var(--accent)]">{analysis.jobFit.score}%</p>
                <p className="mt-1 text-lg">{analysis.jobFit.label}</p>
              </div>
              <p className="max-w-md text-sm text-[var(--muted)]">{analysis.jobFit.summary}</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e8e2d6]">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${analysis.jobFit.score}%` }} />
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <h3 className="mb-2 font-semibold text-[var(--good)]">Strong match</h3>
              <List items={analysis.jobFit.strongMatch} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold text-[var(--warn)]">Partial match</h3>
              <List items={analysis.jobFit.partialMatch} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold text-[var(--bad)]">Missing / weak</h3>
              <List items={analysis.jobFit.missingWeak} />
            </Card>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="mb-2 font-semibold">Candidate strengths</h3>
              <List items={analysis.candidate.strengths} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Claims to probe in interview</h3>
              <List items={analysis.candidate.claimsToProbe} />
            </Card>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={startInterview} disabled={busy}>
              {busy ? "Starting…" : "Start AI voice interview"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <Pill>{LEVEL_LABEL[currentLevel]}</Pill>
              <span className="text-xs font-semibold text-[var(--muted)]">
                Progress {turns.length}/9 · {progress}%
              </span>
            </div>
            <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#e8e2d6]">
              <div className="h-full bg-[var(--accent-2)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">AI interviewer</p>
            <h2 className="display mt-2 text-2xl leading-snug sm:text-3xl">
              {currentQ || (busy ? "Preparing your next question…" : "…")}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="ghost" disabled={!currentQ || speaking} onClick={() => { setSpeaking(true); speak(currentQ, () => setSpeaking(false)); }}>
                {speaking ? "Speaking…" : "Replay question"}
              </Button>
              <Button
                variant={listening ? "danger" : "primary"}
                className={listening ? "listening" : ""}
                onClick={toggleListen}
                disabled={busy || !currentQ}
              >
                {listening ? "Stop listening" : "Speak answer"}
              </Button>
              <Button variant="ghost" onClick={toggleVideo}>{videoOn ? "Stop camera" : "Enable video"}</Button>
            </div>
            <textarea
              className="mt-4 h-36 w-full rounded-xl border border-[var(--line)] bg-white/80 p-3 text-sm outline-none focus:border-[var(--accent)]"
              placeholder="Your answer appears here (voice or typed)…"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
            />
            {speechMeta && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Speech signals: {speechMeta.wordCount} words · ~{speechMeta.wpm} wpm · {speechMeta.fillers} filler(s)
              </p>
            )}
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => finishInterview(turns)} disabled={busy || turns.length < 3}>
                End & evaluate
              </Button>
              <Button onClick={() => submitAnswer()} disabled={busy || !answer.trim()}>
                {busy ? "Thinking…" : "Submit answer"}
              </Button>
            </div>
          </Card>
          <div className="space-y-4">
            <Card>
              <h3 className="mb-2 font-semibold">Video booth (bonus)</h3>
              <div className="aspect-video overflow-hidden rounded-xl bg-[#1a2229]">
                <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Camera is optional. Evaluation focuses on answer quality, not facial emotion.
              </p>
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Transcript</h3>
              <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
                {turns.length === 0 && <p className="text-[var(--muted)]">Answers will appear here.</p>}
                {turns.map((t) => (
                  <div key={t.id} className="rounded-lg bg-[#f6f2e9] p-3">
                    <p className="text-xs font-semibold text-[var(--accent)]">{LEVEL_LABEL[t.level]}</p>
                    <p className="mt-1 font-medium">{t.question}</p>
                    <p className="mt-1 text-[var(--muted)]">{t.answer}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {step === 4 && report && analysis && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Overall interview score</p>
                <p className="display text-5xl text-[var(--accent)]">{report.overallScore}/100</p>
              </div>
              <div className="text-right">
                <Pill tone={READY[report.readiness].tone}>
                  {READY[report.readiness].emoji} {READY[report.readiness].label}
                </Pill>
                <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{report.readinessRationale}</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(report.competencies).map(([k, v]) => (
              <Card key={k}>
                <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{k.replace(/([A-Z])/g, " $1")}</p>
                <p className="display text-3xl">{v}</p>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="mb-2 font-semibold text-[var(--good)]">Strengths</h3>
              <List items={report.strengths} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold text-[var(--bad)]">Weaknesses</h3>
              <List items={report.weaknesses} />
            </Card>
          </div>

          <Card>
            <h3 className="mb-3 font-semibold">Preparation gaps</h3>
            <div className="space-y-3">
              {report.preparationGaps?.map((g) => (
                <div key={g.topic} className="rounded-xl border border-[var(--line)] p-3">
                  <p className="font-semibold">Priority {g.priority}: {g.topic}</p>
                  <List items={g.review} />
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">{report.prepPlanSummary}</p>
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold">Question-level feedback</h3>
            <div className="space-y-4">
              {report.questionFeedback?.map((q) => (
                <div key={q.id} className="rounded-xl border border-[var(--line)] p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Pill>{LEVEL_LABEL[q.level]}</Pill>
                    {typeof q.score === "number" && <span className="text-sm font-semibold">{q.score}/100</span>}
                  </div>
                  <p className="font-medium">{q.question}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]"><strong>Your answer:</strong> {q.answer}</p>
                  <p className="mt-2 text-sm"><strong>Assessment:</strong> {q.assessment}</p>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-[var(--good)]">What was good</p>
                      <List items={q.whatWasGood || []} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-[var(--warn)]">What could be better</p>
                      <List items={q.whatCouldBeBetter || []} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm"><strong>Ideal direction:</strong> {q.idealDirection}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => { setStep(0); setReport(null); setTurns([]); }}>New session</Button>
            <Button onClick={startInterview} disabled={busy}>Retry interview</Button>
          </div>
        </div>
      )}
    </Shell>
  );
}
