import { describe, it, expect } from "vitest";
import { sameName, addDays, bar } from "../bot/util";
import { normalizeRows, parseJsonRows } from "../bot/nlu";

describe("ism solishtirish", () => {
  it("qo'shimcha, harf va alifbo farqlariga chidamli", () => {
    expect(sameName("Alisher", "Alisherga")).toBe(true);
    expect(sameName("Alisher", "Алишер")).toBe(true);
    expect(sameName("Alisher", "Alishr")).toBe(true);
    expect(sameName("Alisher", "Bobur")).toBe(false);
  });
});

describe("sana va progress", () => {
  it("addDays oy chegarasidan o'tadi", () => expect(addDays("2026-10-31", 1)).toBe("2026-11-01"));
  it("bar bo'sh va to'liq", () => { expect(bar(0, 100, 4)).toBe("░░░░"); expect(bar(100, 100, 4)).toBe("▓▓▓▓"); });
});

describe("AI javobini tekshirish", () => {
  it("noto'g'ri qatorlarni tashlaydi va qarzda ismni talab qiladi", () => {
    const rows = [
      { kind: "EXPENSE", amount: 5000, category: "Transport", note: "avtobus", date: "2026-10-29", confidence: 0.95 },
      { kind: "DEBT_BORROWED", amount: 500000, category: "", note: "", person: "", date: "2026-10-29", confidence: 0.9 },
      { kind: "EXPENSE", amount: -5, category: "x", note: "", date: "2026-10-29", confidence: 0.9 },
    ];
    const { ops, uncertain } = normalizeRows(rows, "avtobusga besh ming");
    expect(ops.length).toBe(1);
    expect(uncertain).toBe(2);
  });
  it("matnda yo'q summani belgilaydi", () => {
    const { ops } = normalizeRows([{ kind: "EXPENSE", amount: 99000, category: "Boshqa", note: "", date: "2026-10-29", confidence: 0.99 }], "ovqatga besh ming");
    expect(ops[0].warn).toBe("amount");
  });
  it("```json bilan o'ralgan javobni o'qiydi", () => expect(parseJsonRows('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]));
});
