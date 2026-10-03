import OpenAI from "openai";

function client() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
  });
}

function models(): string[] {
  const primary = process.env.OPENAI_MODEL || "gemini-flash-lite-latest";
  const fallbacks = (process.env.OPENAI_FALLBACK_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set([primary, ...fallbacks, "gemini-2.0-flash", "gemini-flash-lite-latest"])];
}

export async function chatJson<T>(system: string, user: string): Promise<T> {
  const openai = client();
  let lastErr: unknown;
  for (const model of models()) {
    try {
      const res = await openai.chat.completions.create({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const text = res.choices[0]?.message?.content || "{}";
      return JSON.parse(text) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM request failed");
}

export async function chatText(system: string, user: string): Promise<string> {
  const openai = client();
  let lastErr: unknown;
  for (const model of models()) {
    try {
      const res = await openai.chat.completions.create({
        model,
        temperature: 0.5,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return res.choices[0]?.message?.content || "";
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("LLM request failed");
}
