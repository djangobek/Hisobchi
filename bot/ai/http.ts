import { AiError, isRetryable, kindFromStatus, redact } from "./errors";
import { sleep } from "../util";

export type HttpResult = { status: number; ok: boolean; json: any; text: string };

/**
 * Bitta HTTP so'rov: timeout, tarmoq xatolari va status kodlari AiError ga aylantirilmaydi —
 * chaqiruvchi (provayder) javobni o'zi tahlil qiladi. Faqat tarmoq/timeout xatosi AiError tashlaydi.
 * `fetch` har safar globalThis'dan olinadi (testlarda almashtiriladi).
 */
export async function httpRequest(provider: string, url: string, init: RequestInit, timeoutMs: number): Promise<HttpResult> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e: any) {
    const timedOut = e?.name === "TimeoutError" || e?.name === "AbortError";
    throw new AiError(provider, timedOut ? "timeout" : "network", `${provider}: ${timedOut ? "javob vaqti tugadi" : "tarmoq xatosi"} (${redact(e?.cause?.code ?? e?.message ?? e)})`);
  }
  const text = await res.text().catch(() => "");
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* JSON bo'lmasligi mumkin */ }
  return { status: res.status, ok: res.ok, json, text };
}

/** Statusi muvaffaqiyatsiz bo'lsa AiError tashlaydi (xabar maxfiy ma'lumotsiz). */
export function assertOk(provider: string, r: HttpResult, detail?: string): void {
  if (r.ok) return;
  const msg = detail || r.json?.error?.message || r.json?.detail?.message || r.json?.message || (typeof r.json?.detail === "string" ? r.json.detail : "") || "API xatosi";
  throw new AiError(provider, kindFromStatus(r.status), `${provider} HTTP ${r.status}: ${redact(String(msg)).slice(0, 200)}`, r.status);
}

/** Cheklangan retry: faqat vaqtinchalik xatolarda (timeout/tarmoq/5xx), `retries` martagacha. */
export async function withRetry<T>(fn: () => Promise<T>, retries = 1, baseDelayMs = 400): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (!isRetryable(e) || i === retries) break;
      await sleep(baseDelayMs * (i + 1));
    }
  }
  throw last;
}
