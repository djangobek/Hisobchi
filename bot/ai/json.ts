/**
 * LLM javobidan JSON ni xavfsiz ajratish va `operations` massivini majburan olish.
 * Qo'llab-quvvatlanadi: toza JSON, ```json ... ``` bilan o'ralgan, oldidan/keyin izoh yozilgan,
 * massiv yoki {operations: [...]} yoki bitta operatsiya obyekti, satr ko'rinishidagi massiv.
 */
import { AiError } from "./errors";

/** Satrlarni hisobga olib, `start` dagi { yoki [ dan boshlanuvchi balansli JSON bo'lagini qaytaradi. */
function balancedSlice(s: string, start: number): string | null {
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return s.slice(start, i + 1);
  }
  return null; // yopilmagan (javob kesilgan)
}

/** Matndan birinchi yaroqli JSON qiymatini topadi; topilmasa `null`. */
export function extractJson(raw: string): unknown | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/^\uFEFF/, "").trim();
  if (!text) return null;
  const candidates: string[] = [text];
  for (const m of text.matchAll(/```(?:json|JSON)?\s*([\s\S]*?)```/g)) candidates.push(m[1].trim());
  // Yopilmagan fence (javob kesilgan) ham bo'lishi mumkin
  const open = text.match(/```(?:json|JSON)?\s*([\s\S]*)$/);
  if (open) candidates.push(open[1].trim());
  for (const c of [...candidates]) {
    for (let i = 0; i < c.length; i++) {
      if (c[i] !== "{" && c[i] !== "[") continue;
      const slice = balancedSlice(c, i);
      if (slice) candidates.push(slice);
      if (candidates.length > 40) break;
    }
  }
  for (const c of candidates) {
    try { return JSON.parse(c); } catch { /* keyingisi */ }
  }
  return null;
}

const ROW_KEYS = ["operations", "ops", "transactions", "items", "records", "data", "result", "results"];

const looksLikeOp = (o: any) => o && typeof o === "object" && !Array.isArray(o) && ("amount" in o) && ("type" in o || "kind" in o);

/** Parse qilingan qiymatdan operatsiya qatorlarini oladi; format noto'g'ri bo'lsa AiError("parse"). */
export function rowsFromParsed(value: unknown, provider = "ai", depth = 0): any[] {
  if (typeof value === "string" && depth < 2) {
    const inner = extractJson(value);
    if (inner !== null) return rowsFromParsed(inner, provider, depth + 1);
  }
  if (Array.isArray(value)) {
    if (value.every(v => v && typeof v === "object" && !Array.isArray(v))) return value;
    throw new AiError(provider, "parse", "AI massivi ichida operatsiya obyektlari emas");
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ROW_KEYS) {
      if (!(key in obj)) continue;
      const v = obj[key];
      if (v === null) return [];
      if (Array.isArray(v) || typeof v === "string" || (v && typeof v === "object" && depth < 2)) {
        try { return rowsFromParsed(v, provider, depth + 1); } catch (e) { if (key === "operations") throw e; }
      }
    }
    if (looksLikeOp(obj)) return [obj];
  }
  throw new AiError(provider, "parse", "AI JSON ichida operations massivi yo'q");
}

/** Matn → operatsiya qatorlari (to'liq yo'l). */
export function parseOperationRows(raw: string, provider = "ai"): any[] {
  const value = extractJson(raw);
  if (value === null) throw new AiError(provider, "parse", "AI javobida yaroqli JSON topilmadi");
  return rowsFromParsed(value, provider);
}
