/** Bot sozlamalari: hammasi .env dan, standart qiymatlar bilan. */
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

export const CFG = {
  /** Qattiq limit (mavjud loyiha talabi): shundan uzun ovoz rad etiladi. */
  voiceMaxSeconds: num(process.env.VOICE_MAX_SECONDS, 60),
  /** Shundan uzun ovozlarda aniq ogohlantirish ko'rsatiladi (rad etilmaydi). */
  voiceWarnSeconds: num(process.env.VOICE_WARN_SECONDS, 15),
  voiceMaxBytes: 10 * 1024 * 1024,
  draftTtlMs: num(process.env.DRAFT_TTL_MINUTES, 15) * 60_000,
  minConfidence: 0.55,
  maxOpsPerMessage: 20,
  /** Bir foydalanuvchi uchun AI/STT so'rovlari: daqiqada */
  rateLimitPerMinute: num(process.env.BOT_RATE_LIMIT_PER_MINUTE, 8),
  /** Provayder kvotasi/kaliti xato bo'lsa, shuncha vaqt o'tkazib yuboriladi */
  providerCooldownMs: 5 * 60_000,
  reminderHour: num(process.env.REMINDER_HOUR, 21),
  debtReminderHour: num(process.env.DEBT_REMINDER_HOUR, 9),
  /** STT: Muxlisa (asosiy) -> ElevenLabs (faqat zaxira). */
  muxlisaTimeoutMs: num(process.env.MUXLISA_TIMEOUT_MS, 30_000),
  elevenLabsTimeoutMs: num(process.env.ELEVENLABS_TIMEOUT_MS, 40_000),
  elevenLabsModel: process.env.ELEVENLABS_STT_MODEL || "scribe_v1",
  elevenLabsLanguage: process.env.ELEVENLABS_STT_LANGUAGE || "uz",
  /** NLU: Groq (yagona) -> lokal parser. Vergul bilan bir nechta model: birinchisi ishlamasa keyingisi. */
  groqTimeoutMs: num(process.env.GROQ_TIMEOUT_MS, 25_000),
  groqModels: (process.env.GROQ_MODEL || "openai/gpt-oss-120b,llama-3.3-70b-versatile").split(",").map(s => s.trim()).filter(Boolean),
  /** Takroriy Telegram update/audio dedup oynasi */
  dedupTtlMs: 10 * 60_000,
};
