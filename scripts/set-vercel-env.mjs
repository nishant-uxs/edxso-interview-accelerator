import { readFileSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";

const env = {};
for (const line of readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 1 || line.startsWith("#")) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const keys = [
  "OPENAI_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_MODEL",
  "OPENAI_FALLBACK_MODELS",
  "NEXT_PUBLIC_APP_NAME",
];

for (const key of keys) {
  const value = env[key];
  if (!value) continue;
  for (const target of ["production", "preview"]) {
    spawnSync("vercel", ["env", "rm", key, target, "-y"], { stdio: "ignore", shell: true });
    writeFileSync(".env.val.tmp", value, { encoding: "utf8" });
    const r = spawnSync("vercel", ["env", "add", key, target], {
      input: value,
      encoding: "utf8",
      shell: true,
    });
    console.log(key, target, r.status === 0 ? "ok" : (r.stderr || r.stdout || "").slice(0, 120));
  }
}
