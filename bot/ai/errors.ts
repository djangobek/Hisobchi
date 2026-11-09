/**
 * AI xizmatlari uchun yagona xato modeli.
 * Xatolar kategoriyaga ajratiladi: qaysi biri qayta urinishga loyiq, qaysi biri provayderni
 * vaqtincha o'chirib qo'yishi kerak (circuit breaker) — shunga qarab qaror qilinadi.
 */
export type AiErrorKind =
  | "config"   // kalit/endpoint sozlanmagan
  | "auth"     // 401/403 — kalit noto'g'ri yoki ruxsat yo'q
  | "quota"    // 402/429 — limit yoki balans tugagan
  | "timeout"  // so'rov vaqti tugadi
  | "network"  // tarmoq xatosi
  | "server"   // 5xx / 408
  | "client"   // boshqa 4xx — so'rov formati/model nomi/audio formati noto'g'ri
  | "empty"    // provayder bo'sh javob qaytardi
  | "parse"    // javobni o'qib bo'lmadi (JSON buzilgan, operations yo'q)
  | "unusable"; // javob bor, lekin yaroqsiz (masalan, mazmunsiz transkripsiya)

export class AiError extends Error {
  constructor(
    public readonly provider: string,
    public readonly kind: AiErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

/** Vaqtinchalik xatolar: bir marta qayta urinish mantiqli. */
export const isRetryable = (e: unknown): boolean =>
  e instanceof AiError && (e.kind === "timeout" || e.kind === "network" || e.kind === "server");

/** Provayderni bir muddat o'tkazib yuborish kerak bo'lgan xatolar (kalit/kvota/sozlama). */
export const shouldCoolDown = (e: unknown): boolean =>
  e instanceof AiError && (e.kind === "auth" || e.kind === "quota" || e.kind === "config");

export function kindFromStatus(status: number): AiErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 402 || status === 429) return "quota";
  if (status === 408 || status >= 500) return "server";
  return "client";
}

const SECRET_ENV = ["GROQ_API_KEY", "MUXLISA_API_KEY", "ELEVENLABS_API_KEY", "BOT_TOKEN", "DATABASE_URL"];

/** Loglarga chiqarishdan oldin maxfiy kalitlarni yashiradi. */
export function redact(input: unknown): string {
  let s = input instanceof Error ? input.message : String(input);
  for (const name of SECRET_ENV) {
    const v = process.env[name];
    if (v && v.length >= 6) s = s.split(v).join("***");
  }
  return s.replace(/Bearer\s+[\w.\-]+/gi, "Bearer ***").replace(/bot\d{5,}:[\w-]{20,}/g, "bot***");
}

/** Provayderni vaqtincha o'tkazib yuborish uchun oddiy circuit breaker. */
export class Breaker {
  private until = new Map<string, number>();
  constructor(private readonly ms: number) {}
  isOpen(key: string, now = Date.now()) { return (this.until.get(key) ?? 0) > now; }
  trip(key: string, now = Date.now()) { this.until.set(key, now + this.ms); }
  reset(key?: string) { if (key) this.until.delete(key); else this.until.clear(); }
}
