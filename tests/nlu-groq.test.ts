import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { extractOperations, type NluContext } from "../bot/nlu";
import { groqBreaker } from "../bot/ai/groq";
import { TtlSet } from "../bot/dedup";
import { mockFetch, groqReply } from "./ai-helpers";

const mk = (names: string[], type: "INCOME" | "EXPENSE") => names.map((name, i) => ({ id: `${type[0]}${i}`, name, type }));
const EXP = ["Ovqatlanish", "Oziq-ovqat", "Transport", "Boshqa"], INC = ["Ish haqi", "Qo'shimcha ish", "Boshqa tushum"];
const ctx: NluContext = { categories: [...mk(EXP, "EXPENSE"), ...mk(INC, "INCOME")], expenseCategories: EXP, incomeCategories: INC, knownPeople: [] };
const ops = (...o: object[]) => JSON.stringify({ operations: o });
const exp = (amount: number, category: string, description: string) => ({ type: "expense", amount, currency: "UZS", category, description, date: null });

beforeEach(() => { groqBreaker.reset(); process.env.GROQ_API_KEY = "gsk_secret_test_key_999"; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.GROQ_API_KEY; });

describe("NLU: Groq (mock) — ovozli xabar namunalari", () => {
  it("1) 'Bugun 50 ming so'm tushlikka sarfladim'", async () => {
    const m = mockFetch([groqReply(ops(exp(50000, "Ovqatlanish", "Tushlik")))]);
    const r = await extractOperations("Bugun 50 ming so'm tushlikka sarfladim", ctx);
    expect(r.engine).toBe("groq"); expect(r.ops).toHaveLength(1);
    expect(r.ops[0]).toMatchObject({ kind: "EXPENSE", amount: 50000, category: "Ovqatlanish" });
    // so'rov: to'g'ri endpoint, Bearer, model, json_object
    expect(m.calls[0].url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(m.calls[0].init.body as string);
    expect((m.calls[0].init.headers as any).Authorization).toBe("Bearer gsk_secret_test_key_999");
    expect(body.model).toBe("openai/gpt-oss-120b"); expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain('"operations"'); expect(body.max_completion_tokens).toBeGreaterThanOrEqual(4096);
  });
  it("2) 'Ishdan 3 million so'm maosh oldim' → income", async () => {
    mockFetch([groqReply(ops({ type: "income", amount: 3000000, currency: "UZS", category: "Ish haqi", description: "Maosh", date: null }))]);
    const r = await extractOperations("Ishdan 3 million so'm maosh oldim", ctx);
    expect(r.ops[0]).toMatchObject({ kind: "INCOME", amount: 3000000, category: "Ish haqi" });
  });
  it("3) bir nechta operatsiya: 'Do'kondan 120 mingga mahsulot oldim, taksiga 25 ming sarfladim'", async () => {
    mockFetch([groqReply(ops(exp(120000, "Oziq-ovqat", "Mahsulot"), exp(25000, "Transport", "Taksi")))]);
    const r = await extractOperations("Do'kondan 120 mingga mahsulot oldim, taksiga 25 ming sarfladim", ctx);
    expect(r.ops.map(o => [o.kind, o.amount, o.category])).toEqual([["EXPENSE", 120000, "Oziq-ovqat"], ["EXPENSE", 25000, "Transport"]]);
    expect(r.uncertain).toBe(0);
  });
  it("4) 'Kecha 500 ming so'm qo'shimcha daromad oldim' — sana kecha", async () => {
    mockFetch([groqReply(ops({ type: "income", amount: 500000, currency: "UZS", category: "Qo'shimcha ish", description: "Qo'shimcha daromad", date: "2026-11-09" }))]);
    const r = await extractOperations("Kecha 500 ming so'm qo'shimcha daromad oldim", ctx);
    expect(r.ops[0]).toMatchObject({ kind: "INCOME", amount: 500000, date: "2026-11-09" });
  });
});

describe("NLU: Groq javob formati (ildiz sabab regressiyasi)", () => {
  it("```json fence bilan kelgan javob", async () => {
    mockFetch([groqReply("```json\n" + ops(exp(50000, "Ovqatlanish", "Tushlik")) + "\n```")]);
    expect((await extractOperations("tushlikka 50 ming sarfladim", ctx)).engine).toBe("groq");
  });
  it("izoh bilan o'ralgan javob", async () => {
    mockFetch([groqReply("Albatta! " + ops(exp(50000, "Ovqatlanish", "Tushlik")) + " Yana yordam kerakmi?")]);
    expect((await extractOperations("tushlikka 50 ming sarfladim", ctx)).ops).toHaveLength(1);
  });
  it("model massiv/bitta obyekt qaytarsa ham 'operations yo'q' xatosi bo'lmaydi", async () => {
    mockFetch([groqReply(JSON.stringify(exp(50000, "Ovqatlanish", "Tushlik")))]);
    const r = await extractOperations("tushlikka 50 ming sarfladim", ctx);
    expect(r.engine).toBe("groq"); expect(r.ops).toHaveLength(1);
  });
  it("buzilgan JSON → qat'iy ko'rsatma bilan qayta so'raydi", async () => {
    const m = mockFetch([groqReply('{"operations":[{"type":"expense","amou'), groqReply(ops(exp(50000, "Ovqatlanish", "Tushlik")))]);
    const r = await extractOperations("tushlikka 50 ming sarfladim", ctx);
    expect(r.engine).toBe("groq"); expect(m.calls).toHaveLength(2);
    expect(JSON.parse(m.calls[1].init.body as string).messages[1].content).toContain("toza JSON");
  });
  it("Groq json_validate_failed (400) → failed_generation dan JSON olinadi", async () => {
    mockFetch([{ status: 400, body: { error: { code: "json_validate_failed", message: "bad", failed_generation: "```json\n" + ops(exp(50000, "Ovqatlanish", "Tushlik")) + "\n```" } } }]);
    expect((await extractOperations("tushlikka 50 ming sarfladim", ctx)).engine).toBe("groq");
  });
  it("model topilmasa (404) keyingi model sinaladi", async () => {
    const m = mockFetch([{ status: 404, body: { error: { message: "model not found" } } }, groqReply(ops(exp(50000, "Ovqatlanish", "Tushlik")))]);
    const r = await extractOperations("tushlikka 50 ming sarfladim", ctx);
    expect(r.engine).toBe("groq");
    expect(JSON.parse(m.calls[1].init.body as string).model).toBe("llama-3.3-70b-versatile");
    // llama uchun reasoning parametrlari yuborilmaydi
    expect(JSON.parse(m.calls[1].init.body as string).reasoning_effort).toBeUndefined();
  });
  it("operatsiya yo'q xabar → bo'sh natija (Groq)", async () => {
    mockFetch([groqReply('{"operations":[]}')]);
    const r = await extractOperations("salom, ishlaring qalay", ctx);
    expect(r).toMatchObject({ ops: [], uncertain: 0, engine: "groq" });
  });
});

describe("NLU: noaniq summa va xavfsizlik", () => {
  it("amount: null → bazaga yozilmaydi, 'noaniq' deb qaytadi", async () => {
    mockFetch([groqReply(ops({ ...exp(0, "Ovqatlanish", "Tushlik"), amount: null }))]);
    const r = await extractOperations("tushlikka bir oz pul sarfladim", ctx);
    expect(r.ops).toHaveLength(0); expect(r.uncertain).toBe(1);
  });
  it("AI to'qigan summa rad etiladi", async () => {
    mockFetch([groqReply(ops(exp(500000, "Ovqatlanish", "Tushlik")))]);
    const r = await extractOperations("tushlikka 50 ming sarfladim", ctx);
    expect(r.ops).toHaveLength(0); expect(r.uncertain).toBeGreaterThan(0);
  });
  it("Groq tashlab ketgan summa avtomatik qo'shilmaydi — 'noaniq' bo'ladi", async () => {
    mockFetch([groqReply(ops(exp(120000, "Oziq-ovqat", "Mahsulot")))]);
    const r = await extractOperations("Do'kondan 120 mingga mahsulot oldim, taksiga 25 ming sarfladim", ctx);
    expect(r.ops).toHaveLength(1); expect(r.uncertain).toBe(1); expect(r.engine).toBe("groq");
  });
  it("USD → konvertatsiya qilinmaydi", async () => {
    mockFetch([groqReply(ops({ ...exp(100, "Boshqa", "x"), currency: "USD" }))]);
    const r = await extractOperations("100 dollar sarfladim", ctx);
    expect(r.ops).toHaveLength(0); expect(r.foreignCurrency).toBe(1);
  });
  it("inkor gap — operatsiya emas", async () => {
    mockFetch([groqReply('{"operations":[]}')]);
    const r = await extractOperations("bugun 50 ming sarflamadim", ctx);
    expect(r.ops).toHaveLength(0);
  });
  it("20 tadan ortiq operatsiya → TooManyOpsError", async () => {
    const many = Array.from({ length: 21 }, () => exp(1000, "Boshqa", "x"));
    mockFetch([groqReply(ops(...many))]);
    await expect(extractOperations("1000 ".repeat(21), ctx)).rejects.toThrow();
  });
});

describe("NLU: fallback — faqat Groq ishlamaganda lokal parser", () => {
  const text = "Avtobusga besh ming, ovqatga yetti ming sarfladim";
  it("Groq kaliti yo'q → lokal", async () => {
    delete process.env.GROQ_API_KEY; const m = mockFetch([]);
    const r = await extractOperations(text, ctx);
    expect(r.engine).toBe("local"); expect(r.ops.length).toBe(2); expect(m.calls).toHaveLength(0);
  });
  it("Groq 401 → lokal, keyingi so'rovlar 5 daqiqa Groq'ga bormaydi", async () => {
    const m = mockFetch([{ status: 401, body: { error: { message: "invalid api key" } } }]);
    const r = await extractOperations(text, ctx);
    expect(r.engine).toBe("local"); expect(m.calls).toHaveLength(1);
    const r2 = await extractOperations(text, ctx);
    expect(r2.engine).toBe("local"); expect(m.calls).toHaveLength(1);
  });
  it("Groq 429 → lokal", async () => {
    mockFetch([{ status: 429, body: { error: { message: "rate limit" } } }]);
    expect((await extractOperations(text, ctx)).engine).toBe("local");
  });
  it("Groq tarmoq xatosi/timeout → lokal", async () => {
    mockFetch([Object.assign(new Error("t"), { name: "TimeoutError" }), Object.assign(new Error("t"), { name: "TimeoutError" }), Object.assign(new Error("t"), { name: "TimeoutError" }), Object.assign(new Error("t"), { name: "TimeoutError" })]);
    expect((await extractOperations(text, ctx)).engine).toBe("local");
  });
  it("Groq ikki marta ham yaroqsiz javob → lokal", async () => {
    mockFetch([groqReply("kechirasiz"), groqReply("yana kechirasiz")]);
    expect((await extractOperations(text, ctx)).engine).toBe("local");
  });
  it("Groq bo'sh javob → lokal", async () => {
    mockFetch([{ body: { choices: [{ message: { content: "" }, finish_reason: "length" }] } }, { body: { choices: [{ message: { content: "" } }] } }]);
    expect((await extractOperations(text, ctx)).engine).toBe("local");
  });
  it("kalit loglarda/xatolarda oshkor bo'lmaydi", async () => {
    const warn = console.warn; const lines: string[] = []; console.warn = (...a: any[]) => lines.push(a.join(" "));
    try { mockFetch([{ status: 401, body: { error: { message: "bad key gsk_secret_test_key_999" } } }]); await extractOperations(text, ctx); }
    finally { console.warn = warn; }
    expect(lines.join("\n")).not.toContain("gsk_secret_test_key_999");
  });
});

describe("Takroriy update/audio himoyasi (TtlSet)", () => {
  it("bir xil kalit ikkinchi marta qabul qilinmaydi", () => {
    const s = new TtlSet(1000);
    expect(s.add("u:1")).toBe(true); expect(s.add("u:1")).toBe(false); expect(s.add("u:2")).toBe(true);
  });
  it("TTL o'tgach yana qabul qilinadi", () => {
    const s = new TtlSet(1000);
    expect(s.add("k", 0)).toBe(true); expect(s.add("k", 500)).toBe(false); expect(s.add("k", 1500)).toBe(true);
  });
});
