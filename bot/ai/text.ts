/** STT javobidan matnni ishonchli ajratish va transkripsiyani tekshirish. */

const TEXT_KEYS = ["text", "transcription", "transcript", "recognized_text", "result", "output"];
const NEST_KEYS = ["result", "results", "data", "output", "response", "transcription", "transcript"];

/**
 * Faqat ma'lum kalitlar ostidagi satrni qabul qiladi (xato xabarlari — "message", "error" —
 * hech qachon transkripsiya sifatida o'qilmaydi). Ichma-ich obyekt/massivga tushadi.
 */
export function textFromResponse(value: unknown, depth = 0): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    // Provayder oddiy matn qaytargan bo'lsa (JSON emas)
    return depth === 0 && t && !/^[{[]/.test(t) ? t : null;
  }
  if (!value || typeof value !== "object" || depth > 3) return null;
  if (Array.isArray(value)) {
    const parts = value.map(v => textFromResponse(v, depth + 1)).filter(Boolean) as string[];
    return parts.length ? parts.join(" ") : null;
  }
  const obj = value as Record<string, unknown>;
  for (const key of TEXT_KEYS) {
    const c = obj[key];
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  for (const key of NEST_KEYS) {
    const c = obj[key];
    if (c && typeof c === "object") { const found = textFromResponse(c, depth + 1); if (found) return found; }
  }
  return null;
}

export function normalizeTranscript(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, 4000);
}

/** Transkripsiya yaroqlimi: kamida 2 ta harf/raqam, faqat belgi/shovqin emas. */
export function isUsableTranscript(text: string): boolean {
  const t = normalizeTranscript(text);
  if (t.length < 2) return false;
  const significant = (t.match(/[\p{L}\p{N}]/gu) ?? []).length;
  if (significant < 2) return false;
  // "[noaniq]", "(shovqin)", "..." kabi faqat belgilar
  const stripped = t.replace(/\[[^\]]*\]|\([^)]*\)/g, "").replace(/[^\p{L}\p{N}]/gu, "");
  return stripped.length >= 2;
}
