/**
 * Kategoriyani foydalanuvchining MAVJUD kategoriyalariga moslash (toza modul, testlanadi).
 *
 * Qoida: bot hech qachon yangi kategoriya "o'ylab topmaydi".
 *   1) AI/qoida aytgan nom foydalanuvchida bor bo'lsa — o'sha (nom, sinonim, rus tarjimasi yoki yaqin yozilishi bo'yicha);
 *   2) bo'lmasa — izoh matnidan mavjud kategoriyani topishga urinadi (masalan "kofe" kategoriyasi bor, matnda "kofega");
 *   3) bo'lmasa — kalit so'zlar qoidasi (taksi → Transport) foydalanuvchining mos kategoriyasiga;
 *   4) hech biri to'g'ri kelmasa — foydalanuvchining "Boshqa" (tushumda "Boshqa tushum") kategoriyasi.
 */
import { guessCategoryByRules, normalizeText } from "./voice-parser";

export type CatType = "INCOME" | "EXPENSE";
export type CatInfo = { id: string; name: string; type: CatType };

export type CatMatch = {
  name: string;
  id?: string;      // mavjud kategoriya bo'lsa
  how: "exact" | "alias" | "fuzzy" | "text" | "rule" | "other";
};

export const OTHER_DEFAULT: Record<CatType, string> = { EXPENSE: "Boshqa", INCOME: "Boshqa tushum" };

/** Taqqoslash kaliti: kichik harf, apostrof/bo'shliq/belgilar olib tashlanadi (kirill saqlanadi). */
export function catKey(s: string): string {
  return normalizeText(s).replace(/ё/g, "е").replace(/[^\p{L}\p{N}]/gu, "");
}

/** Standart kategoriyalarning sinonimlari (o'zbek/rus). Kalit — standart nom. */
const GROUPS: Record<string, string[]> = {
  "Ovqatlanish": ["ovqat", "ovqatlanish", "restoran", "kafe", "еда", "питание", "рестораны", "кафе", "food", "dining"],
  "Oziq-ovqat": ["oziqovqat", "oziq", "bozor", "продукты", "продуктыпитания", "grocery", "groceries", "products"],
  "Transport": ["transport", "taksi", "yol", "yoqilgi", "benzin", "транспорт", "такси", "проезд", "авто", "avto"],
  "Uy-joy": ["uyjoy", "uy", "kommunal", "ijara", "жилье", "жильё", "дом", "коммунальные", "аренда", "housing", "rent"],
  "Kiyim-kechak": ["kiyimkechak", "kiyim", "одежда", "одеждаиобувь", "clothes", "clothing"],
  "Ta'lim": ["talim", "oqish", "kurs", "образование", "обучение", "учеба", "education"],
  "Sog'liq": ["sogliq", "salomatlik", "tibbiyot", "dori", "здоровье", "медицина", "health"],
  "Ko'ngilochar": ["kongilochar", "dam", "damolish", "oyin", "развлечения", "отдых", "entertainment"],
  "Boshqa": ["boshqa", "boshqalar", "boshqaxarajat", "boshqaxarajatlar", "turli", "aralash", "другое", "прочее", "разное", "прочиерасходы", "other", "others", "misc"],
  "Ish haqi": ["ishhaqi", "maosh", "oylik", "ish", "avans", "зарплата", "оклад", "salary"],
  "Qo'shimcha ish": ["qoshimchaish", "qoshimcha", "podrabotka", "подработка", "премия", "бонус", "bonus"],
  "Freelance": ["freelance", "frilans", "фриланс"],
  "Savdo": ["savdo", "sotuv", "торговля", "продажи", "business", "biznes"],
  "Sovg'a": ["sovga", "inom", "подарок", "подарки", "gift", "gifts"],
  "Boshqa tushum": ["boshqatushum", "boshqatushumlar", "прочиедоходы", "другоедоход", "otherincome"],
};
const KEY_TO_GROUP = new Map<string, string>();
for (const [group, keys] of Object.entries(GROUPS)) { KEY_TO_GROUP.set(catKey(group), group); for (const k of keys) if (!KEY_TO_GROUP.has(catKey(k))) KEY_TO_GROUP.set(catKey(k), group); }
const groupOf = (name: string): string | undefined => KEY_TO_GROUP.get(catKey(name));

/** "Boshqa" turidagi kategoriyami (Boshqa, Boshqa xarajat, Другое, Other, ...). */
export function isOtherName(name: string): boolean {
  const k = catKey(name);
  return groupOf(name) === "Boshqa" || groupOf(name) === "Boshqa tushum" || k.startsWith("boshqa") || k.startsWith("другое") || k.startsWith("прочи") || k === "other";
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Foydalanuvchining "boshqa" kategoriyasi (bo'lmasa — standart nom, saqlashda yaratiladi). */
export function findOther(type: CatType, cats: CatInfo[]): CatMatch {
  const mine = cats.filter(c => c.type === type);
  const exact = mine.find(c => catKey(c.name) === catKey(OTHER_DEFAULT[type]));
  const any = exact ?? mine.find(c => isOtherName(c.name));
  return any ? { name: any.name, id: any.id, how: "other" } : { name: OTHER_DEFAULT[type], how: "other" };
}

/** Matn ichida foydalanuvchi kategoriyasi nomi uchraydimi ("kofega" ↔ "Kofe"). Eng uzun moslik g'olib. */
function matchByText(text: string, mine: CatInfo[]): CatInfo | undefined {
  const words = normalizeText(text).split(" ").map(catKey).filter(w => w.length >= 3);
  if (!words.length) return undefined;
  let best: CatInfo | undefined, bestLen = 0;
  for (const c of mine) {
    if (isOtherName(c.name)) continue;
    const ck = catKey(c.name);
    if (ck.length < 4) continue;
    if (words.some(w => w.startsWith(ck) || (w.length >= 4 && ck.startsWith(w))) && ck.length > bestLen) { best = c; bestLen = ck.length; }
  }
  return best;
}

/**
 * @param raw   AI/qoida taklif qilgan nom (bo'sh bo'lishi mumkin)
 * @param hint  izoh/gap matni (nom topilmasa kalit so'z va matn bo'yicha qidirish uchun)
 */
export function resolveCategory(raw: string, type: CatType, cats: CatInfo[], hint = ""): CatMatch {
  const mine = cats.filter(c => c.type === type);
  const pick = (c: CatInfo, how: CatMatch["how"]): CatMatch => ({ name: c.name, id: c.id, how });
  const rk = catKey(raw);

  const text = `${hint} ${raw}`.trim();
  if (rk) {
    const exact = mine.find(c => catKey(c.name) === rk);
    if (exact) return pick(exact, "exact");
    // "Boshqa" ma'nosidagi har qanday nom — foydalanuvchining "boshqa" kategoriyasi
    if (isOtherName(raw)) return findOther(type, cats);
  }
  // Gapda foydalanuvchining o'z kategoriyasi nomi aytilgan bo'lsa ("kofega" ↔ "Kofe") — u aniqroq, sinonimdan ustun.
  const byText = text ? matchByText(text, mine) : undefined;
  if (byText) return pick(byText, "text");
  if (rk) {
    const g = groupOf(raw);
    if (g) { const alias = mine.find(c => groupOf(c.name) === g); if (alias) return pick(alias, "alias"); }
    if (rk.length >= 4) {
      const part = mine.find(c => { const ck = catKey(c.name); return ck.length >= 4 && (ck.startsWith(rk) || rk.startsWith(ck)); });
      if (part) return pick(part, "fuzzy");
      const near = mine.find(c => { const ck = catKey(c.name); return Math.abs(ck.length - rk.length) <= 2 && lev(ck, rk) <= (rk.length >= 7 ? 2 : 1); });
      if (near) return pick(near, "fuzzy");
    }
  }
  // Kalit so'z qoidasi: izoh bo'lsa faqat izohga qaraymiz (AI to'qigan nom qoidani chalg'itmasin)
  const ruleText = hint.trim() || raw;
  const rule = ruleText ? guessCategoryByRules(ruleText, type) : null;
  if (rule) {
    const hit = mine.find(c => catKey(c.name) === catKey(rule)) ?? mine.find(c => groupOf(c.name) === rule);
    if (hit) return pick(hit, "rule");
  }
  return findOther(type, cats);
}
