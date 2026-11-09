import { describe, it, expect } from "vitest";
import { extractJson, parseOperationRows } from "../bot/ai/json";
import { parseJsonRows, normalizeRows, normalizeCurrency, type NluContext } from "../bot/nlu";

const op = { type: "expense", amount: 50000, currency: "UZS", category: "Ovqatlanish", description: "Tushlik", date: null };

describe("Groq JSON parsing", () => {
  it("toza {operations:[...]}", () => expect(parseOperationRows(JSON.stringify({ operations: [op] }))).toEqual([op]));
  it("```json fence", () => expect(parseOperationRows("```json\n" + JSON.stringify({ operations: [op] }) + "\n```")).toEqual([op]));
  it("fence tilsiz ``` ", () => expect(parseOperationRows("```\n" + JSON.stringify({ operations: [op] }) + "\n```")).toEqual([op]));
  it("oldidan va keyin izoh bilan", () => {
    const raw = `Mana natija: ${JSON.stringify({ operations: [op] })}\nBoshqa savol bo'lsa ayting.`;
    expect(parseOperationRows(raw)).toEqual([op]);
  });
  it("izoh ichidagi { } belgilari JSON'ni buzmaydi", () => {
    const raw = `{ eslatma } ${JSON.stringify({ operations: [{ ...op, description: "a } b { c" }] })}`;
    expect(parseOperationRows(raw)[0].description).toBe("a } b { c");
  });
  it("ildiz bug: json_object rejimi bitta obyekt qaytarsa ham operatsiya olinadi", () => expect(parseOperationRows(JSON.stringify(op))).toEqual([op]));
  it("massiv ko'rinishi", () => expect(parseOperationRows(JSON.stringify([op]))).toEqual([op]));
  it("muqobil kalit (transactions)", () => expect(parseOperationRows(JSON.stringify({ transactions: [op] }))).toEqual([op]));
  it("ichma-ich data.operations", () => expect(parseOperationRows(JSON.stringify({ data: { operations: [op] } }))).toEqual([op]));
  it("satr ko'rinishidagi operations", () => expect(parseOperationRows(JSON.stringify({ operations: JSON.stringify([op]) }))).toEqual([op]));
  it("bo'sh operations — xato emas", () => expect(parseOperationRows('{"operations":[]}')).toEqual([]));
  it("operations: null — bo'sh", () => expect(parseOperationRows('{"operations":null}')).toEqual([]));
  it("ko'p operatsiya", () => expect(parseOperationRows(JSON.stringify({ operations: [op, { ...op, amount: 25000 }] }))).toHaveLength(2));
  it("buzilgan JSON → parse xatosi", () => expect(() => parseOperationRows('{"operations":[{"type":"expense","amount":')).toThrow(/JSON/));
  it("kesilgan javob → parse xatosi", () => expect(() => parseOperationRows('```json\n{"operations":[{"type":"exp')).toThrow());
  it("JSON yo'q → parse xatosi", () => expect(() => parseOperationRows("Kechirasiz, tushunmadim")).toThrow(/yaroqli JSON/));
  it("operations yo'q → aniq xabar", () => expect(() => parseOperationRows('{"foo":1}')).toThrow(/operations massivi yo'q/));
  it("operations massiv emas (son)", () => expect(() => parseOperationRows('{"operations":5}')).toThrow());
  it("bo'sh satr", () => expect(() => parseOperationRows("   ")).toThrow());
  it("extractJson null qaytaradi", () => expect(extractJson("matn")).toBeNull());
  it("eski parseJsonRows testi", () => expect(parseJsonRows('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]));
});

const mkc = (names: string[], type: "INCOME" | "EXPENSE") => names.map((name, i) => ({ id: `${type[0]}${i}`, name, type }));
const ctx: NluContext = { categories: [...mkc(["Ovqatlanish", "Transport", "Boshqa"], "EXPENSE"), ...mkc(["Ish haqi", "Boshqa tushum"], "INCOME")], expenseCategories: ["Ovqatlanish", "Transport", "Boshqa"], incomeCategories: ["Ish haqi", "Boshqa tushum"], knownPeople: [] };

describe("normalizeRows: summa, valyuta, tur", () => {
  it("yangi format (type/description/date:null) qabul qilinadi", () => {
    const { ops } = normalizeRows([op], "Bugun 50 ming so'm tushlikka sarfladim");
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "EXPENSE", amount: 50000, note: "Tushlik" });
    expect(ops[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("income turi", () => {
    const { ops } = normalizeRows([{ type: "income", amount: 3_000_000, currency: "UZS", category: "Ish haqi", description: "Maosh", date: null }], "Ishdan 3 million so'm maosh oldim", ctx);
    expect(ops[0]).toMatchObject({ kind: "INCOME", amount: 3_000_000, category: "Ish haqi" });
  });
  it("ikki operatsiya bitta xabardan", () => {
    const rows = [{ ...op, amount: 120000, description: "Mahsulot" }, { ...op, amount: 25000, category: "Transport", description: "Taksi" }];
    const { ops } = normalizeRows(rows, "Do'kondan 120 mingga mahsulot oldim, taksiga 25 ming sarfladim", ctx);
    expect(ops.map(o => o.amount)).toEqual([120000, 25000]);
  });
  it("noto'g'ri type rad etiladi", () => {
    const { ops, uncertain } = normalizeRows([{ ...op, type: "transfer" }], "50 ming");
    expect(ops).toHaveLength(0); expect(uncertain).toBe(1);
  });
  it("amount null / 0 / manfiy / matn → noaniq", () => {
    const rows = [{ ...op, amount: null }, { ...op, amount: 0 }, { ...op, amount: -5 }, { ...op, amount: "bir necha" }];
    const r = normalizeRows(rows, "tushlikka sarfladim 50 ming");
    expect(r.ops).toHaveLength(0); expect(r.uncertain).toBe(4);
  });
  it("satr ko'rinishidagi summa '50 000' o'qiladi", () => {
    expect(normalizeRows([{ ...op, amount: "50 000" }], "50 ming").ops[0].amount).toBe(50000);
  });
  it("AI to'qigan summa rad etiladi", () => {
    const r = normalizeRows([{ ...op, amount: 500000 }], "Bugun 50 ming so'm tushlikka sarfladim");
    expect(r.ops).toHaveLength(0); expect(r.uncertain).toBe(1);
  });
  it("bir summa ikki marta ishlatilmaydi", () => {
    const r = normalizeRows([op, { ...op }], "Bugun 50 ming so'm tushlikka sarfladim");
    expect(r.ops).toHaveLength(1); expect(r.uncertain).toBe(1);
  });
  it("USD valyuta konvertatsiya qilinmaydi, rad etiladi", () => {
    const r = normalizeRows([{ ...op, amount: 100, currency: "USD" }], "100 dollar sarfladim");
    expect(r.ops).toHaveLength(0); expect(r.foreignCurrency).toBe(1);
  });
  it("valyuta aytilmasa UZS", () => expect(normalizeRows([{ ...op, currency: null }], "50 ming").ops).toHaveLength(1));
  it("normalizeCurrency variantlari", () => {
    expect(["so'm", "сум", "UZS", "som", ""].map(normalizeCurrency)).toEqual(["UZS", "UZS", "UZS", "UZS", "UZS"]);
    expect(["$", "dollar", "USD"].map(normalizeCurrency)).toEqual(["USD", "USD", "USD"]);
    expect(normalizeCurrency("евро")).toBe("EUR");
  });
  it("qarz: debt maydoni va ism", () => {
    const r = normalizeRows([{ type: "income", debt: "borrowed", person: "Alisher", amount: 500000, currency: "UZS", category: "", description: "", date: null }], "Alisherdan 500 ming qarz oldim");
    expect(r.ops[0]).toMatchObject({ kind: "DEBT_BORROWED", person: "Alisher", amount: 500000 });
  });
  it("qarzda ism yo'q → noaniq", () => {
    const r = normalizeRows([{ type: "expense", debt: "lent", person: null, amount: 300000, currency: "UZS", category: "", date: null }], "300 ming qarz berdim");
    expect(r.ops).toHaveLength(0); expect(r.uncertain).toBe(1);
  });
  it("confidence berilmasa operatsiya rad etilmaydi", () => expect(normalizeRows([op], "50 ming").ops).toHaveLength(1));
  it("past confidence rad etiladi", () => expect(normalizeRows([{ ...op, confidence: 0.2 }], "50 ming").ops).toHaveLength(0));
});
