import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { transcribe, resetSttState, SttFailure } from "../bot/stt";
import { textFromResponse, isUsableTranscript } from "../bot/ai/text";
import { redact } from "../bot/ai/errors";
import { mockFetch } from "./ai-helpers";

const audio = Buffer.from("OggS-fake-audio");
const MUX = "service.muxlisa.uz";
const EL = "api.elevenlabs.io";
const run = () => transcribe(audio, "voice.oga", "audio/ogg", "uz");

beforeEach(() => {
  resetSttState();
  process.env.MUXLISA_API_KEY = "mux-secret-key-123";
  process.env.ELEVENLABS_API_KEY = "el-secret-key-456";
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.MUXLISA_API_KEY; delete process.env.ELEVENLABS_API_KEY; });

describe("Muxlisa STT (mock)", () => {
  it("muvaffaqiyat: ElevenLabs CHAQIRILMAYDI", async () => {
    const m = mockFetch([{ body: { text: "bugun ellik ming so'm tushlikka sarfladim" } }]);
    const r = await run();
    expect(r).toMatchObject({ provider: "muxlisa", fallback: false, text: "bugun ellik ming so'm tushlikka sarfladim" });
    expect(m.calls).toHaveLength(1);
    expect(m.calls[0].url).toContain(MUX);
    expect((m.calls[0].init.headers as any)["x-api-key"]).toBe("mux-secret-key-123");
    expect(m.calls[0].init.body).toBeInstanceOf(FormData);
    expect((m.calls[0].init.body as FormData).get("audio")).toBeInstanceOf(Blob);
  });
  it("turli javob shakllari: result.text, transcription, ichma-ich", async () => {
    for (const body of [{ result: { text: "salom dunyo" } }, { transcription: "salom dunyo" }, { status: "ok", data: { transcript: "salom dunyo" } }]) {
      resetSttState(); mockFetch([{ body }]);
      expect((await run()).text).toBe("salom dunyo");
    }
  });
  it("xato xabari transkripsiya sifatida o'qilmaydi", () => {
    expect(textFromResponse({ message: "Unauthorized", error: "bad key" })).toBeNull();
    expect(textFromResponse({ status: "error", detail: "quota" })).toBeNull();
  });
  it("5xx da bir marta qayta urinadi", async () => {
    const m = mockFetch([{ status: 503, body: { error: "down" } }, { body: { text: "yetmish ming so'm" } }]);
    const r = await run();
    expect(r.provider).toBe("muxlisa"); expect(m.calls).toHaveLength(2);
  });
});

describe("ElevenLabs fallback (mock)", () => {
  it("Muxlisa HTTP xatosi → ElevenLabs", async () => {
    const m = mockFetch([{ status: 500, body: {} }, { status: 500, body: {} }, { body: { text: "kecha besh yuz ming so'm daromad oldim", language_code: "uzb" } }]);
    const r = await run();
    expect(r).toMatchObject({ provider: "elevenlabs", fallback: true });
    expect(m.calls.at(-1)!.url).toContain(EL);
    expect((m.calls.at(-1)!.init.headers as any)["xi-api-key"]).toBe("el-secret-key-456");
    const form = m.calls.at(-1)!.init.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v1"); expect(form.get("file")).toBeInstanceOf(Blob);
  });
  it("Muxlisa 401 (kalit xato) → retry qilinmaydi, to'g'ridan-to'g'ri ElevenLabs", async () => {
    const m = mockFetch([{ status: 401, body: { error: "bad key" } }, { body: { text: "uch million so'm maosh" } }]);
    const r = await run();
    expect(r.provider).toBe("elevenlabs"); expect(m.calls).toHaveLength(2);
  });
  it("Muxlisa timeout → ElevenLabs", async () => {
    const t = Object.assign(new Error("timeout"), { name: "TimeoutError" });
    mockFetch([t, t, { body: { text: "taksiga yigirma besh ming" } }]);
    expect((await run()).provider).toBe("elevenlabs");
  });
  it("Muxlisa bo'sh transkripsiya → ElevenLabs", async () => {
    mockFetch([{ body: { text: "" } }, { body: { text: "ovqatga qirq ming" } }]);
    expect((await run()).provider).toBe("elevenlabs");
  });
  it("Muxlisa yaroqsiz transkripsiya ('...') → ElevenLabs", async () => {
    mockFetch([{ body: { text: "..." } }, { body: { text: "ovqatga qirq ming" } }]);
    expect((await run()).provider).toBe("elevenlabs");
  });
  it("ElevenLabs til kodi rad etilsa (422) tilsiz qayta urinadi", async () => {
    mockFetch([{ status: 500, body: {} }, { status: 500, body: {} }, { status: 422, body: { detail: { message: "bad language" } } }, { body: { text: "ovqatga qirq ming" } }]);
    const m = (globalThis.fetch as any).mock;
    const r = await run();
    expect(r.provider).toBe("elevenlabs");
    expect(m.calls.length).toBe(4);
    expect((m.calls[3][1].body as FormData).get("language_code")).toBeNull();
  });
  it("Muxlisa kaliti yo'q → faqat ElevenLabs", async () => {
    delete process.env.MUXLISA_API_KEY;
    const m = mockFetch([{ body: { text: "ovqatga qirq ming" } }]);
    expect((await run()).provider).toBe("elevenlabs"); expect(m.calls).toHaveLength(1);
  });
});

describe("STT to'liq muvaffaqiyatsizlik", () => {
  it("ikkalasi ham ishlamasa — SttFailure(unavailable), kalitlar xabarda yo'q", async () => {
    mockFetch([{ status: 500, body: {} }, { status: 500, body: {} }, { status: 500, body: {} }, { status: 500, body: {} }]);
    const e: any = await run().catch(x => x);
    expect(e).toBeInstanceOf(SttFailure); expect(e.reason).toBe("unavailable");
    expect(e.message).not.toContain("mux-secret-key-123"); expect(e.message).not.toContain("el-secret-key-456");
  });
  it("ikkalasi bo'sh transkripsiya → reason=unusable", async () => {
    mockFetch([{ body: { text: "" } }, { body: { text: " " } }]);
    expect(((await run().catch(x => x)) as SttFailure).reason).toBe("unusable");
  });
  it("hech qanday kalit yo'q → unconfigured", async () => {
    delete process.env.MUXLISA_API_KEY; delete process.env.ELEVENLABS_API_KEY;
    expect(((await run().catch(x => x)) as SttFailure).reason).toBe("unconfigured");
  });
});

describe("yordamchilar", () => {
  it("isUsableTranscript", () => {
    expect(isUsableTranscript("ovqatga 50 ming")).toBe(true);
    for (const bad of ["", " ", "...", "[noaniq]", "(shovqin)", "a"]) expect(isUsableTranscript(bad)).toBe(false);
  });
  it("redact kalitlarni yashiradi", () => {
    expect(redact(new Error("failed with mux-secret-key-123 and Bearer abc.def-123"))).not.toMatch(/mux-secret|abc\.def/);
  });
});
