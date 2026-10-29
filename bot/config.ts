/** Bot sozlamalari: hammasi .env dan, standart qiymatlar bilan. */
const num = (v: string | undefined, d: number) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };

export const CFG = {
  voiceMaxSeconds: num(process.env.VOICE_MAX_SECONDS, 60),
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
  elevenLabsModel: process.env.ELEVENLABS_STT_MODEL || "scribe_v1",
  elevenLabsLanguage: process.env.ELEVENLABS_STT_LANGUAGE || "uz",
  geminiModels: (process.env.GEMINI_MODEL || "gemini-2.5-flash").split(",").map(s => s.trim().replace(/^models\//, "")).filter(Boolean),
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
};
