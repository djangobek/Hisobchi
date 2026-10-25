import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { RateLimitError } from "./rate-limit";

/**
 * Texnologiya #3: ETag + shartli (304 Not Modified) javoblar.
 * Ma'lumot o'zgarmagan bo'lsa server body yubormaydi — trafik va CPU tejaladi.
 */
export function etagJson(req: NextRequest, data: unknown, opts: { maxAge?: number; extra?: Record<string, string> } = {}) {
  const body = JSON.stringify(data);
  const etag = `W/"${createHash("sha1").update(body).digest("base64url").slice(0, 27)}"`;
  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": `private, max-age=${opts.maxAge ?? 0}, must-revalidate`,
    Vary: "x-telegram-init-data",
    ...opts.extra,
  };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(body, { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
}

/** Xatoni to'g'ri status bilan qaytaradi (oldin hammasi 403 edi). */
export function adminError(e: unknown) {
  if (e instanceof RateLimitError)
    return NextResponse.json({ error: e.message }, { status: 429, headers: { "Retry-After": String(e.retryAfterSec) } });
  const msg = e instanceof Error ? e.message : "Xatolik.";
  const status = /Ruxsat/.test(msg) ? 403 : /topilmadi|sessiya/i.test(msg) ? 401 : /bloklangan/.test(msg) ? 403 : 500;
  return NextResponse.json({ error: msg }, { status });
}
