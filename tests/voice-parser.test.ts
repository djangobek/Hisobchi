import { describe, it, expect } from "vitest";
import { extractAmounts, parseFinanceText, guessCategory } from "../src/lib/voice-parser";

const amounts = (s: string) => extractAmounts(s).map(x => x.value);

describe("o'zbek va rus sonlari", () => {
  it("oddiy sonlar", () => {
    expect(amounts("besh ming")).toEqual([5000]);
    expect(amounts("250 ming")).toEqual([250000]);
    expect(amounts("25k")).toEqual([25000]);
  });
  it("murakkab sonlar", () => {
    expect(amounts("yetti yuz ellik ming")).toEqual([750000]);
    expect(amounts("ikki yuz ming so'm")).toEqual([200000]);
    expect(amounts("bir yarim million")).toEqual([1500000]);
    expect(amounts("1.5 млн")).toEqual([1500000]);
  });
  it("rus tili", () => {
    expect(amounts("пятьсот тысяч")).toEqual([500000]);
    expect(amounts("три тысячи двести")).toEqual([3200]);
  });
  it("bir nechta summa", () => {
    expect(amounts("avtobusga besh ming ovqatga yetti ming")).toEqual([5000, 7000]);
  });
});

describe("operatsiyalarni ajratish", () => {
  it("fe'li umumiy bo'lgan xarajat va daromad", () => {
    const ops = parseFinanceText("Avtobusga besh ming, ovqatga yetti ming sarfladim, ish haqimdan ikki yuz ming tushdi");
    expect(ops.map(o => [o.kind, o.amount])).toEqual([["EXPENSE", 5000], ["EXPENSE", 7000], ["INCOME", 200000]]);
    expect(ops[0].category).toBe("Transport");
    expect(ops[2].category).toBe("Ish haqi");
  });
  it("qarz olish", () => {
    const [op] = parseFinanceText("Alisherdan 500 ming qarz oldim");
    expect(op).toMatchObject({ kind: "DEBT_BORROWED", amount: 500000, person: "Alisher" });
  });
  it("qarz berish", () => {
    const [op] = parseFinanceText("Boburga uch yuz ming qarz berdim");
    expect(op).toMatchObject({ kind: "DEBT_LENT", amount: 300000, person: "Bobur" });
  });
  it("qarz qaytarildi (sizga) va qaytardim (siz)", () => {
    expect(parseFinanceText("Dilnoza qarzini qaytardi 200 ming")[0]).toMatchObject({ kind: "REPAY_IN", person: "Dilnoza" });
    expect(parseFinanceText("Qarzimni Bobur akaga ikki yuz ming qaytardim")[0]).toMatchObject({ kind: "REPAY_OUT", person: "Bobur" });
  });
  it("rus tilida aralash", () => {
    const ops = parseFinanceText("потратил 25 тысяч на такси и занял у Алишера 1 млн");
    expect(ops.map(o => o.kind)).toEqual(["EXPENSE", "DEBT_BORROWED"]);
  });
  it("summasiz gap operatsiya emas", () => {
    expect(parseFinanceText("bugun ob-havo yaxshi")).toEqual([]);
  });
  it("kategoriya taxmini", () => {
    expect(guessCategory("taksi", "EXPENSE")).toBe("Transport");
    expect(guessCategory("noma'lum", "EXPENSE")).toBe("Boshqa");
  });
});
