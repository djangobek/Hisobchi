/**
 * Nutq → matn (STT).
 * Tartib: 1) ElevenLabs Scribe (asosiy)  2) Muxlisa AI (zaxira).
 * - Vaqtinchalik xato (5xx/timeout/tarmoq) bo'lsa bir marta qayta uriniladi.
 * - Kalit noto'g'ri / kvota tugagan (401/402/403/429) bo'lsa provayder 5 daqiqaga o'tkazib yuboriladi
 *   (circuit breaker), keyingi so'rovlar vaqt yo'qotmaydi.
 */
import { CFG } from "./config";
import { sleep } from "./util";

export type SttProvider = "elevenlabs" | "muxlisa";
export type SttResult = { text: string; provider: SttProvider };

class SttError extends Error {
  constructor(message: string, public readonly status?: number, public readonly fatal = false) { super(message); }
}

const cooldownUntil: Record<SttProvider, number> = { elevenlabs: 0, muxlisa: 0 };

function extractText(value: any): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  for (const key of ["text", "transcription", "transcript", "result", "recognized_text", "output"]) {
    const c = value[key];
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  for (const c of Object.values(value)) { const found = extractText(c); if (found) return found; }
  return null;
}

async function viaElevenLabs(audio: Buffer, filename: string, mime: string, hint: string | null): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new SttError("ELEVENLABS_API_KEY sozlanmagan", undefined, true);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), filename);
  form.append("model_id", CFG.elevenLabsModel);
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");
  if (hint) form.append("language_code", hint);
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(45_000),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok) throw new SttError(`ElevenLabs HTTP ${res.status}`, res.status, [401, 402, 403, 429].includes(res.status));
  const text = extractText(data);
  if (!text) throw new SttError("ElevenLabs bo'sh transkripsiya qaytardi");
  return text;
}

async function viaMuxlisa(audio: Buffer, filename: string, mime: string): Promise<string> {
  const key = process.env.MUXLISA_API_KEY;
  if (!key) throw new SttError("MUXLISA_API_KEY sozlanmagan", undefined, true);
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: mime }), filename);
  const res = await fetch("https://service.muxlisa.uz/api/v2/stt", {
    method: "POST", headers: { "x-api-key": key }, body: form, signal: AbortSignal.timeout(45_000),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok) throw new SttError(`Muxlisa HTTP ${res.status}`, res.status, [401, 402, 403, 429].includes(res.status));
  const text = extractText(data);
  if (!text) throw new SttError("Muxlisa bo'sh yoki tanilmagan javob qaytardi");
  return text;
}

async function attempt(name: SttProvider, run: () => Promise<string>): Promise<string> {
  let lastErr: unknown;
  for (let i = 0; i < 2; i++) {
    try { return await run(); }
    catch (e) {
      lastErr = e;
      if (e instanceof SttError && (e.fatal || (e.status && e.status < 500 && e.status !== 408))) break;
      if (i === 0) await sleep(600);
    }
  }
  if (lastErr instanceof SttError && lastErr.fatal && lastErr.status) cooldownUntil[name] = Date.now() + CFG.providerCooldownMs;
  throw lastErr;
}

export const sttConfigured = () => Boolean(process.env.ELEVENLABS_API_KEY || process.env.MUXLISA_API_KEY);

/** @param uiLang foydalanuvchi interfeys tili: "ru" bo'lsa til avtomatik aniqlanadi (ElevenLabs). */
export async function transcribe(audio: Buffer, filename: string, mime: string, uiLang: "uz" | "ru"): Promise<SttResult> {
  const hint = uiLang === "ru" ? null : CFG.elevenLabsLanguage === "auto" ? null : CFG.elevenLabsLanguage;
  const chain: { name: SttProvider; enabled: boolean; run: () => Promise<string> }[] = [
    { name: "elevenlabs", enabled: Boolean(process.env.ELEVENLABS_API_KEY), run: () => viaElevenLabs(audio, filename, mime, hint) },
    { name: "muxlisa", enabled: Boolean(process.env.MUXLISA_API_KEY), run: () => viaMuxlisa(audio, filename, mime) },
  ];
  const errors: string[] = [];
  // Cooldowndagi provayderlar oxiriga suriladi (butunlay tashlab yuborilmaydi — zaxira bo'lib qoladi).
  const ordered = [...chain.filter(p => p.enabled)].sort((a, b) => Number(cooldownUntil[a.name] > Date.now()) - Number(cooldownUntil[b.name] > Date.now()));
  for (const p of ordered) {
    try {
      const text = await attempt(p.name, p.run);
      return { text, provider: p.name };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.name}: ${msg}`);
      console.warn(`[STT] ${p.name} muvaffaqiyatsiz (${msg}).${p === ordered[ordered.length - 1] ? "" : " Keyingisiga o'tilmoqda."}`);
    }
  }
  throw new Error(errors.length ? `Barcha STT provayderlari xato: ${errors.join(" | ")}` : "STT provayderi sozlanmagan");
}
