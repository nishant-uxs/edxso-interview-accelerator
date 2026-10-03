"use client";

export type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((ev: { results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean } } }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function speak(text: string, onEnd?: () => void): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onEnd?.();
    return null;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.02;
  u.pitch = 1;
  u.lang = "en-IN";
  const voices = window.speechSynthesis.getVoices();
  const preferred =
    voices.find((v) => /en-(IN|GB|US)/i.test(v.lang) && /female|google|natural/i.test(v.name)) ||
    voices.find((v) => /en-/i.test(v.lang));
  if (preferred) u.voice = preferred;
  u.onend = () => onEnd?.();
  window.speechSynthesis.speak(u);
  return u;
}

export function stopSpeaking() {
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

export function analyzeSpeechMeta(answer: string, durationMs: number) {
  const words = answer.trim().split(/\s+/).filter(Boolean);
  const fillers = (answer.match(/\b(um+|uh+|like|you know|basically|actually)\b/gi) || []).length;
  const minutes = Math.max(durationMs / 60000, 0.01);
  const wpm = Math.round(words.length / minutes);
  const longPauseHint = durationMs > 8000 && words.length < 12;
  return { wordCount: words.length, fillers, wpm, longPauseHint, durationMs };
}
