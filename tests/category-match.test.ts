import { describe, it, expect } from "vitest";
import { resolveCategory, findOther, type CatInfo } from "../src/lib/category-match";
import { normalizeRows, type NluContext } from "../bot/nlu";

const mk = (names: string[], type: "INCOME" | "EXPENSE"): CatInfo[] => names.map((name, i) => ({ id: `${type[0]}${i}`, name, type }));
const EXP = ["Ovqatlanish", "Oziq-ovqat", "Transport", "Uy-joy", "Kofe", "Boshqa"];
const INC = ["Ish haqi", "Freelance", "Boshqa tushum"];
const cats = [...mk(EXP, "EXPENSE"), ...mk(INC, "INCOME")];
const ctx: NluContext = { categories: cats, expenseCategories: EXP, incomeCategories: INC, knownPeople: [] };

describe("kategoriyani mavjudlariga moslash", () => {
  it("aniq nom", () => expect(resolveCategory("Transport", "EXPENSE", cats)).toMatchObject({ name: "Transport", how: "exact" }));
  it("harf/apostrof farqi", () => expect(resolveCategory("oziq ovqat", "EXPENSE", cats).name).toBe("Oziq-ovqat"));
  it("rus tarjimasi", () => expect(resolveCategory("Транспорт", "EXPENSE", cats).name).toBe("Transport"));
  it("izoh matnidan foydalanuvchi kategoriyasi", () => expect(resolveCategory("Kafe", "EXPENSE", cats, "kofega 20 ming")).toMatchObject({ name: "Kofe" }));
  it("kalit so'z qoidasi → foydalanuvchining kategoriyasi", () => expect(resolveCategory("", "EXPENSE", cats, "taksiga 20 ming").name).toBe("Transport"));
  it("mos kelmasa — Boshqa", () => {
    const m = resolveCategory("Uy hayvonlari", "EXPENSE", cats, "mushukka 30 ming");
    expect(m).toMatchObject({ name: "Boshqa", how: "other", id: "E5" });
  });
  it("tushumda — Boshqa tushum", () => expect(resolveCategory("Lotereya", "INCOME", cats, "yutuq").name).toBe("Boshqa tushum"));
  it("turi aralashmaydi (xarajat nomi tushumga tushmaydi)", () => expect(resolveCategory("Transport", "INCOME", cats).name).toBe("Boshqa tushum"));
  it("foydalanuvchining 'boshqa' kategoriyasi boshqacha nomlangan bo'lsa ham topiladi", () => {
    const c = mk(["Transport", "Boshqa xarajatlar"], "EXPENSE");
    expect(findOther("EXPENSE", c).name).toBe("Boshqa xarajatlar");
    expect(resolveCategory("Другое", "EXPENSE", c).name).toBe("Boshqa xarajatlar");
  });
  it("'boshqa' umuman yo'q bo'lsa standart nom qaytadi (saqlashda yaratiladi)", () => {
    const m = resolveCategory("xyz", "EXPENSE", mk(["Transport"], "EXPENSE"));
    expect(m.name).toBe("Boshqa"); expect(m.id).toBeUndefined();
  });
});

describe("AI qatorlari → mavjud kategoriya", () => {
  const row = (category: string, note = "") => ({ kind: "EXPENSE", amount: 5000, category, note, date: "2026-10-29", confidence: 0.95 });
  it("AI to'qigan nom mavjud kategoriyaga o'giriladi", () => {
    const { ops } = normalizeRows([row("Taksi xizmatlari", "taksi")], "taksiga besh ming", ctx);
    expect(ops[0].category).toBe("Transport");
    expect(ops[0].catFallback).toBeUndefined();
  });
  it("mos kelmaydigan nom → Boshqa va ogohlantirish belgisi", () => {
    const { ops } = normalizeRows([row("Uy hayvonlari", "mushuk qumi")], "mushuk qumiga besh ming", ctx);
    expect(ops[0]).toMatchObject({ category: "Boshqa", catFallback: true });
  });
});
