/**
 * Nutq -> matn (STT), uch bosqichli failover:
 * 1) Gemini multimodal audio (asosiy)
 * 2) ElevenLabs Scribe (ikkinchi provayder)
 * 3) Muxlisa (uchinchi/zaxira provayder)
 *
 * Transkripsiya original tilda olinadi; tarjima yoki xulosa qilish taqiqlangan.
 * Har bir provayder alohida timeout va circuit-breaker bilan ishlaydi.
 */
import { CFG } from "./config";
import { sleep } from "./util";

export type SttProvider = "gemini" | "elevenlabs" | "muxlisa";
export type SttResult = { text: string; provider: SttProvider };

class SttError extends Error {
  constructor(message: string, public readonly status?: number, public readonly fatal = false) { super(message); }
}

const cooldownUntil: Record<SttProvider, number> = { gemini: 0, elevenlabs: 0, muxlisa: 0 };

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

function normalizeTranscript(text: string): string {
  return text.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, 12_000);
}

async function viaGemini(audio: Buffer, mime: string, uiLang: "uz" | "ru"): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new SttError("GEMINI_API_KEY sozlanmagan", undefined, true);
  const model = CFG.geminiSttModel;
  const prompt = uiLang === "ru"
    ? "Точно расшифруй речь в аудио. Сохрани исходный язык, имена, числа, валюты и порядок слов. Не переводи, не пересказывай и не исправляй смысл. Верни только распознанный текст. Если фрагмент неразборчив, обозначь его как [неразборчиво]."
    : "Audio ichidagi nutqni aynan yozuvga aylantir. O'zbekcha/ruscha aralash nutq bo'lsa, asl tillarni saqla. Ismlar, summalar, sonlar, valyuta birliklari va so'zlar tartibini o'zgartirma. Tarjima, xulosa yoki izoh yozma. Faqat transkripsiyani qaytar. Tushunarsiz joyni [noaniq] deb belgilagin.";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: prompt },
        { inline_data: { mime_type: mime || "audio/ogg", data: audio.toString("base64") } },
      ] }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
    signal: AbortSignal.timeout(55_000),
  });
  const data: any = await res.json().catch(() => null);
  if (!res.ok) throw new SttError(`Gemini STT HTTP ${res.status}: ${data?.error?.message || "API xatosi"}`, res.status, [400, 401, 403, 404, 429].includes(res.status));
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join(" ").trim();
  if (!text) throw new SttError("Gemini bo'sh transkripsiya qaytardi");
  return text;
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
    try { return normalizeTranscript(await run()); }
    catch (e) {
      lastErr = e;
      if (e instanceof SttError && (e.fatal || (e.status && e.status < 500 && e.status !== 408))) break;
      if (i === 0) await sleep(500);
    }
  }
  if (lastErr instanceof SttError && (lastErr.fatal || lastErr.status === 429 || lastErr.status === 402)) {
    cooldownUntil[name] = Date.now() + CFG.providerCooldownMs;
  }
  throw lastErr;
}

export const sttConfigured = () => Boolean(process.env.GEMINI_API_KEY || process.env.ELEVENLABS_API_KEY || process.env.MUXLISA_API_KEY);

/** uiLang faqat tilga oid ko'rsatma; rus interfeysida ham audio tili avtomatik aniqlanadi. */
export async function transcribe(audio: Buffer, filename: string, mime: string, uiLang: "uz" | "ru"): Promise<SttResult> {
  const hint = uiLang === "ru" ? null : CFG.elevenLabsLanguage === "auto" ? null : CFG.elevenLabsLanguage;
  const chain: { name: SttProvider; enabled: boolean; run: () => Promise<string> }[] = [
    { name: "gemini", enabled: Boolean(process.env.GEMINI_API_KEY), run: () => viaGemini(audio, mime, uiLang) },
    { name: "elevenlabs", enabled: Boolean(process.env.ELEVENLABS_API_KEY), run: () => viaElevenLabs(audio, filename, mime, hint) },
    { name: "muxlisa", enabled: Boolean(process.env.MUXLISA_API_KEY), run: () => viaMuxlisa(audio, filename, mime) },
  ];
  const enabled = chain.filter(p => p.enabled);
  // Sog'lom provayderlar belgilangan tartibda; cooldown bo'lganlar keyinga suriladi.
  const ordered = [...enabled.filter(p => cooldownUntil[p.name] <= Date.now()), ...enabled.filter(p => cooldownUntil[p.name] > Date.now())];
  const errors: string[] = [];
  for (const p of ordered) {
    try {
      const text = await attempt(p.name, p.run);
      if (!text) throw new SttError("Bo'sh transkripsiya");
      return { text, provider: p.name };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${p.name}: ${msg}`);
      console.warn(`[STT] ${p.name} muvaffaqiyatsiz; fallback davom etadi (${msg})`);
    }
  }
  throw new Error(errors.length ? `Barcha STT provayderlari xato: ${errors.join(" | ")}` : "STT provayderi sozlanmagan");
}
