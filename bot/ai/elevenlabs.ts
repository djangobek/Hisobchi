/**
 * ElevenLabs Scribe — faqat ovoz → matn (STT) uchun, faqat Muxlisa ishlamaganda.
 * POST https://api.elevenlabs.io/v1/speech-to-text  (xi-api-key, multipart: file, model_id, language_code?)
 * Javob: { text, language_code, words: [...] }
 */
import { AiError } from "./errors";
import { assertOk, httpRequest, withRetry } from "./http";
import { textFromResponse } from "./text";

const URL_STT = "https://api.elevenlabs.io/v1/speech-to-text";

export async function elevenLabsTranscribe(
  audio: Buffer, filename: string, mime: string, opts: { model: string; language: string | null; timeoutMs: number },
): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new AiError("elevenlabs", "config", "ELEVENLABS_API_KEY sozlanmagan");

  const send = (language: string | null) => withRetry(async () => {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mime || "audio/ogg" }), filename || "voice.ogg");
    form.append("model_id", opts.model);
    form.append("tag_audio_events", "false");
    form.append("diarize", "false");
    if (language) form.append("language_code", language);
    const r = await httpRequest("elevenlabs", URL_STT, { method: "POST", headers: { "xi-api-key": key }, body: form }, opts.timeoutMs);
    assertOk("elevenlabs", r);
    return r;
  }, 1);

  let r;
  try { r = await send(opts.language); }
  catch (e) {
    // Til kodi qabul qilinmagan bo'lsa (400/422) — avtomatik aniqlash bilan bir marta qayta urinamiz.
    if (opts.language && e instanceof AiError && (e.status === 400 || e.status === 422)) r = await send(null);
    else throw e;
  }
  const text = textFromResponse(r.json);
  if (!text) throw new AiError("elevenlabs", "empty", "ElevenLabs bo'sh transkripsiya qaytardi", r.status);
  return text;
}
