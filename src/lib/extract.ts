export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    // unpdf works in Node/Vercel without browser DOMMatrix globals
    const { extractText } = await import("unpdf");
    const data = new Uint8Array(buf);
    const { text } = await extractText(data, { mergePages: true });
    const joined = Array.isArray(text) ? text.join("\n") : String(text || "");
    return joined.trim();
  }

  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const out = await mammoth.extractRawText({ buffer: buf });
    return (out.value || "").trim();
  }

  return buf.toString("utf-8").trim();
}

export function clip(text: string, max = 14000): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n\n[truncated]";
}
