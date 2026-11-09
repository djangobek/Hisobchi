/**
 * Nutq → matn (STT).
 *   1) Muxlisa AI — asosiy va birinchi.
 *   2) ElevenLabs Scribe — faqat Muxlisa ishlamasa yoki transkripsiya yaroqsiz bo'lsa.
 * Gemini/Groq STT sifatida ishlatilmaydi. Muxlisa muvaffaqiyatli bo'lsa ElevenLabs chaqirilmaydi.
 * Audio faqat xotirada (Buffer); diskka yozilmaydi.
 */
import { CFG } from "./config";
import { AiError, Breaker, redact, shouldCoolDown } from "./ai/errors";
import { muxlisaTranscribe } from "./ai/muxlisa";
import { elevenLabsTranscribe } from "./ai/elevenlabs";
import { isUsableTranscript, normalizeTranscript } from "./ai/text";

export type SttProvider = "muxlisa" | "elevenlabs";
export type SttResult = { text: string; provider: SttProvider; fallback: boolean };

/** Foydalanuvchiga ko'rsatiladigan sabab turi (texnik matn emas). */
export type SttFailReason = "unconfigured" | "unusable" | "unavailable";
export class SttFailure extends Error {
  constructor(public readonly reason: SttFailReason, public readonly details: string[] = []) {
    super(`STT muvaffaqiyatsiz: ${reason}${details.length ? ` (${details.join(" | ")})` : ""}`);
    this.name = "SttFailure";
  }
}

const breaker = new Breaker(CFG.providerCooldownMs);
/** Testlar uchun. */
export const resetSttState = () => breaker.reset();

export const sttConfigured = () => Boolean(process.env.MUXLISA_API_KEY || process.env.ELEVENLABS_API_KEY);

type Step = { name: SttProvider; enabled: boolean; run: () => Promise<string> };

export async function transcribe(audio: Buffer, filename: string, mime: string, uiLang: "uz" | "ru"): Promise<SttResult> {
  // Rus interfeysida til avtomatik aniqlanadi; o'zbekda sozlangan til (standart "uz").
  const hint = uiLang === "ru" || CFG.elevenLabsLanguage === "auto" ? null : CFG.elevenLabsLanguage;
  const steps: Step[] = [
    { name: "muxlisa", enabled: Boolean(process.env.MUXLISA_API_KEY), run: () => muxlisaTranscribe(audio, filename, mime, CFG.muxlisaTimeoutMs) },
    { name: "elevenlabs", enabled: Boolean(process.env.ELEVENLABS_API_KEY), run: () => elevenLabsTranscribe(audio, filename, mime, { model: CFG.elevenLabsModel, language: hint, timeoutMs: CFG.elevenLabsTimeoutMs }) },
  ];
  const enabled = steps.filter(s => s.enabled);
  if (!enabled.length) throw new SttFailure("unconfigured");

  // Tartib doim: Muxlisa → ElevenLabs. Kalit/kvota xatosi bo'lgan provayder vaqtincha oxirga suriladi.
  const ordered = [...enabled.filter(s => !breaker.isOpen(s.name)), ...enabled.filter(s => breaker.isOpen(s.name))];
  const errors: string[] = [];
  let emptyish = 0; // bo'sh yoki yaroqsiz transkripsiya (xizmat ishladi, lekin matn chiqmadi)
  for (const step of ordered) {
    try {
      const text = normalizeTranscript(await step.run());
      if (!isUsableTranscript(text)) throw new AiError(step.name, "unusable", `${step.name}: yaroqsiz transkripsiya`);
      return { text, provider: step.name, fallback: step.name !== "muxlisa" };
    } catch (e) {
      if (e instanceof AiError && (e.kind === "unusable" || e.kind === "empty")) emptyish++;
      if (shouldCoolDown(e) && !(e instanceof AiError && e.kind === "config")) breaker.trip(step.name);
      const msg = redact(e);
      errors.push(msg);
      console.warn(`[STT] ${step.name} muvaffaqiyatsiz${step === ordered[ordered.length - 1] ? "" : "; zaxiraga o'tilmoqda"}: ${msg}`);
    }
  }
  // Hammasi yaroqsiz/bo'sh transkripsiya qaytargan bo'lsa — bu ovoz muammosi, xizmat muammosi emas.
  throw new SttFailure(emptyish >= ordered.length ? "unusable" : "unavailable", errors);
}
