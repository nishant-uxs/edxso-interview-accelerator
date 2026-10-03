import { readFileSync } from "fs";

const path = process.argv[2] || ".env.vercel";
const t = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
for (const raw of t.split(/\r?\n/)) {
  const line = raw.replace(/^export\s+/, "");
  const i = line.indexOf("=");
  if (i < 1 || line.startsWith("#")) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (k === "OPENAI_API_KEY") console.log("KEY len", v.length, "prefix", v.slice(0, 8));
  if (k === "OPENAI_BASE_URL") console.log("BASE", JSON.stringify(v));
  if (k === "OPENAI_MODEL") console.log("MODEL", JSON.stringify(v));
  if (k === "OPENAI_FALLBACK_MODELS") console.log("FALLBACK", JSON.stringify(v));
}
