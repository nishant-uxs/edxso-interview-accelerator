import OpenAI from "openai";
import { readFileSync } from "fs";

for (const line of readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 1 || line.startsWith("#")) continue;
  process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

const models = [
  process.env.OPENAI_MODEL,
  ...(process.env.OPENAI_FALLBACK_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean),
];

for (const model of models) {
  try {
    const res = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: 'Return JSON {"ok":true}' },
        { role: "user", content: "ping" },
      ],
    });
    console.log("OK", model, res.choices[0].message.content);
    process.exit(0);
  } catch (e) {
    console.log("FAIL", model, e.status || "", e.message?.slice(0, 120));
  }
}
process.exit(1);
