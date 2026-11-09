/**
 * Muxlisa AI — asosiy STT provayderi.
 * Endpoint: POST {MUXLISA_STT_URL | https://service.muxlisa.uz/api/v2/stt}
 *   sarlavha: x-api-key: <MUXLISA_API_KEY>
 *   tana: multipart/form-data, maydon "audio" (fayl)
 * ⚠️ Endpoint/maydon nomi Muxlisa'ning shaxsiy kabinetidagi hujjat bilan solishtirilishi kerak;
 *    farq bo'lsa .env ichida MUXLISA_STT_URL va MUXLISA_AUDIO_FIELD orqali o'zgartiriladi.
 */
import { AiError } from "./errors";
import { assertOk, httpRequest, withRetry } from "./http";
import { textFromResponse } from "./text";

const DEFAULT_URL = "https://service.muxlisa.uz/api/v2/stt";

export async function muxlisaTranscribe(audio: Buffer, filename: string, mime: string, timeoutMs: number): Promise<string> {
  const key = process.env.MUXLISA_API_KEY;
  if (!key) throw new AiError("muxlisa", "config", "MUXLISA_API_KEY sozlanmagan");
  const url = process.env.MUXLISA_STT_URL || DEFAULT_URL;
  const field = process.env.MUXLISA_AUDIO_FIELD || "audio";

  return withRetry(async () => {
    const form = new FormData(); // har urinishda yangi FormData (stream bir marta o'qiladi)
    form.append(field, new Blob([new Uint8Array(audio)], { type: mime || "audio/ogg" }), filename || "voice.ogg");
    const r = await httpRequest("muxlisa", url, { method: "POST", headers: { "x-api-key": key }, body: form }, timeoutMs);
    assertOk("muxlisa", r);
    const text = textFromResponse(r.json ?? r.text);
    if (!text) throw new AiError("muxlisa", "empty", "Muxlisa bo'sh transkripsiya qaytardi", r.status);
    return text;
  }, 1);
}
