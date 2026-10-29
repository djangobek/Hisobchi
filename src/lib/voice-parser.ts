/**
 * Ovozli/matnli moliyaviy iboralarni lokal (AI'siz) tahlil qiluvchi toza modul.
 *
 * Vazifalari:
 *  1. O'zbek va rus tilidagi sonlarni raqamga aylantirish ("yetti yuz ellik ming" => 750000).
 *  2. Matnni operatsiyalarga bo'lish: xarajat, daromad, qarz berish/olish, qarz qaytarish.
 *  3. Kategoriyani kalit so'zlar bo'yicha taxmin qilish.
 *
 * AI (Gemini/Groq) javob bermasa ham bot shu modul orqali ishlashda davom etadi.
 * Modul hech qanday tashqi bog'liqliksiz — shuning uchun unit-testlanadi.
 */

export type OpKind = "INCOME" | "EXPENSE" | "DEBT_LENT" | "DEBT_BORROWED" | "REPAY_IN" | "REPAY_OUT";

export type ParsedOp = {
  kind: OpKind;
  amount: number;
  category: string;
  note: string;
  person?: string;
  confidence: number;
};

/** Apostrof/harf variantlarini bir xil ko'rinishga keltiradi. */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "'")
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}'\s.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Sonlar                                                              */
/* ------------------------------------------------------------------ */

const UNITS: Record<string, number> = {
  // o'zbek
  nol: 0, bir: 1, ikki: 2, uch: 3, "to'rt": 4, tort: 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, "to'qqiz": 9, toqqiz: 9,
  // rus
  ноль: 0, один: 1, одна: 1, одну: 1, два: 2, две: 2, три: 3, четыре: 4, пять: 5, шесть: 6, семь: 7, восемь: 8, девять: 9,
};
const TENS: Record<string, number> = {
  on: 10, yigirma: 20, "o'ttiz": 30, ottiz: 30, qirq: 40, ellik: 50, oltmish: 60, yetmish: 70, sakson: 80, "to'qson": 90, toqson: 90,
  десять: 10, двадцать: 20, тридцать: 30, сорок: 40, пятьдесят: 50, шестьдесят: 60, семьдесят: 70, восемьдесят: 80, девяносто: 90,
};
const TEENS_RU: Record<string, number> = {
  одиннадцать: 11, двенадцать: 12, тринадцать: 13, четырнадцать: 14, пятнадцать: 15, шестнадцать: 16, семнадцать: 17, восемнадцать: 18, девятнадцать: 19,
};
const HUNDREDS_RU: Record<string, number> = {
  сто: 100, двести: 200, триста: 300, четыреста: 400, пятьсот: 500, шестьсот: 600, семьсот: 700, восемьсот: 800, девятьсот: 900,
};
const HUNDRED_WORDS = new Set(["yuz", "сто"]);
const SCALE: Record<string, number> = {
  ming: 1_000, минг: 1_000, тысяча: 1_000, тысячи: 1_000, тысяч: 1_000, тыс: 1_000, k: 1_000, к: 1_000,
  million: 1_000_000, mln: 1_000_000, миллион: 1_000_000, миллиона: 1_000_000, миллионов: 1_000_000, млн: 1_000_000,
  milliard: 1_000_000_000, mlrd: 1_000_000_000, миллиард: 1_000_000_000, миллиарда: 1_000_000_000, миллиардов: 1_000_000_000, млрд: 1_000_000_000,
};
const HALF = new Set(["yarim", "половина", "пол"]);
const CURRENCY = new Set([
  "so'm", "som", "sum", "sumga", "so'mga", "сум", "сумов", "сума", "сумы", "сўм", "uzs", "so'mlik", "somlik", "сумов",
]);

type Token = { raw: string; num?: number; scale?: number; isHundred?: boolean; isHalf?: boolean };

function classify(word: string): Token {
  const w = word.replace(/[.,]+$/g, "");
  if (/^\d+([.,]\d+)?$/.test(w)) return { raw: word, num: Number(w.replace(",", ".")) };
  if (w in UNITS) return { raw: word, num: UNITS[w] };
  if (w in TENS) return { raw: word, num: TENS[w] };
  if (w in TEENS_RU) return { raw: word, num: TEENS_RU[w] };
  if (w in HUNDREDS_RU) return { raw: word, num: HUNDREDS_RU[w] };
  if (HUNDRED_WORDS.has(w)) return { raw: word, isHundred: true };
  if (w in SCALE) return { raw: word, scale: SCALE[w] };
  if (HALF.has(w)) return { raw: word, isHalf: true };
  return { raw: word };
}

export type NumberSpan = { value: number; start: number; end: number };

/**
 * So'zlar ketma-ketligidan barcha summalarni topadi.
 * Misollar: "besh ming" 5000; "bir yarim million" 1_500_000; "250 ming" 250000;
 * "yetti yuz ellik ming" 750000; "25k" 25000; "1.5 млн" 1500000.
 */
export function extractAmounts(text: string): NumberSpan[] {
  const words = normalizeText(text)
    // "25k", "25ming" kabi yopishgan yozuvlarni ajratamiz
    .replace(/(\d)(k|к|ming|минг|млн|mln|million|тыс)\b/g, "$1 $2")
    .split(" ")
    .filter(Boolean);
  const tokens = words.map(classify);
  const spans: NumberSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.num === undefined && !t.isHundred && !t.isHalf) { i++; continue; }
    // "yarim" yolg'iz kelsa raqam emas
    if (t.isHalf && !(tokens[i - 1] && tokens[i - 1].num !== undefined)) { i++; continue; }

    let total = 0, current = 0, j = i, consumed = false, lastScale = Infinity;
    const start = i;
    while (j < tokens.length) {
      const k = tokens[j];
      if (k.num !== undefined) {
        // "5 ming 3" kabi: oldingi lastScale dan kichik bo'lsagina davom etamiz
        if (current !== 0 && !(tokens[j - 1]?.isHundred) && Number.isInteger(k.num) && Number.isInteger(current)
          && String(current).length <= String(k.num).length && k.num >= 10 && current >= 10 && !tokens[j - 1]?.scale) break;
        current += k.num; consumed = true; j++;
      } else if (k.isHundred) {
        current = (current === 0 ? 1 : current) * 100; consumed = true; j++;
      } else if (k.isHalf) {
        // "bir yarim million": current=1 -> 1.5
        current = (current || 1) + 0.5; consumed = true; j++;
      } else if (k.scale) {
        if (k.scale >= lastScale) break;
        const base = current === 0 ? 1 : current;
        total += base * k.scale; current = 0; lastScale = k.scale; consumed = true; j++;
      } else break;
    }
    if (!consumed) { i++; continue; }
    const value = Math.round(total + current);
    // Yolg'iz "bir"/"ikki" kabi kichik so'zlar (masalan "bir kun") summa emas: faqat >= 100 yoki ko'rsatilgan valyuta bilan
    const next = tokens[j]?.raw.replace(/[.,]+$/g, "");
    const hasCurrency = next ? CURRENCY.has(next) : false;
    const wordOnly = tokens.slice(start, j).every(x => !/^\d/.test(x.raw));
    if (value >= 100 || hasCurrency || (!wordOnly && value > 0)) spans.push({ value, start, end: hasCurrency ? j + 1 : j });
    i = Math.max(j, i + 1);
  }
  return spans;
}

/** Bitta summani qaytaradi (eng birinchisi) yoki null. */
export function parseAmount(text: string): number | null {
  return extractAmounts(text)[0]?.value ?? null;
}

/* ------------------------------------------------------------------ */
/* Niyat (intent) aniqlash                                             */
/* ------------------------------------------------------------------ */

const EXPENSE_VERBS = /(sarfla|to'la[dm]|to'ladim|xarj|sotib ол|sotib ol|oldim|berdim|ketdi|chiqdi|kеtdi|потрат|заплат|купил|оплат|отдал за|ушло|расход)/;
const INCOME_VERBS = /(tushdi|tushum|topdim|maosh|oylik|ish haqi|daromad|keldi|oldim maosh|получил зарплат|зарплат|заработал|доход|пришло|поступил|premiya|bonus|kashbek|cashback)/;
const LENT_WORDS = /(qarz berdim|qarzga berdim|qarz berib|qarzga pul berdim|qarz bo'ldi.*menga|дал в долг|одолжил|занял ему|дал взаймы|qarz berdi?m)/;
const BORROW_WORDS = /(qarz oldim|qarzga oldim|qarz olib|qarz so'radim|qarzdorman|qarz bo'ldim|взял в долг|занял у|одолжил у|занял|qarzga pul oldim)/;
const REPAY_IN_WORDS = /(qarzini qaytardi\b|qarzini berdi\b|qaytarib berdi\b|qaytardi\b|qarzini to'ladi\b|вернул мне|отдал долг мне|qaytarib oldim|qarzini oldim|qarzini qaytarib)/;
const REPAY_OUT_WORDS = /(qarzimni|qaytardim\b|qaytarib berdim|to'ladim.*qarz|qarz.*to'ladim|вернул долг|вернул ему|отдал долг|погасил долг|qarzdan to'ladim)/;

const CATEGORY_RULES: { cat: string; type: "INCOME" | "EXPENSE"; re: RegExp }[] = [
  { cat: "Transport", type: "EXPENSE", re: /(avtobus|taksi|taxi|yandex|metro|benzin|yoqilg'i|gaz quy|mashina|avto|transport|bus|такси|бензин|метро|автобус|проезд|заправ)/ },
  { cat: "Oziq-ovqat", type: "EXPENSE", re: /(bozor|do'kon|market|go'sht|non|sut|sabzavot|meva|oziq|продукт|магазин|рынок|хлеб|мясо|korzinka|makro)/ },
  { cat: "Ovqatlanish", type: "EXPENSE", re: /(ovqat|tushlik|nonushta|kechki|restoran|kafe|choyxona|osh|lavash|burger|fast|кафе|обед|ужин|завтрак|еда|ресторан|пицца|coffee|kofe|кофе)/ },
  { cat: "Uy-joy", type: "EXPENSE", re: /(ijara|kommunal|elektr|svet|gaz|suv|internet|uy|kvartira|remont|аренда|коммунал|квартира|электричеств|интернет|свет)/ },
  { cat: "Kiyim-kechak", type: "EXPENSE", re: /(kiyim|ko'ylak|shim|oyoq kiyim|krossovka|kurtka|одежд|обув|куртк|джинс)/ },
  { cat: "Ta'lim", type: "EXPENSE", re: /(kurs|o'qish|kitob|dars|repetitor|universitet|kontrakt|maktab|обучен|учеб|книг|курс|репетитор)/ },
  { cat: "Sog'liq", type: "EXPENSE", re: /(dori|apteka|shifokor|doktor|klinika|tish|analiz|kasalxona|лекарств|аптек|врач|больниц|стоматолог)/ },
  { cat: "Ko'ngilochar", type: "EXPENSE", re: /(kino|o'yin|konsert|dam olish|sayohat|bilet|theatre|teatr|кино|игр|развлеч|концерт|путешеств|отдых|bowling)/ },
  { cat: "Ish haqi", type: "INCOME", re: /(maosh|oylik|ish haqi|avans|зарплат|оклад|аванс)/ },
  { cat: "Freelance", type: "INCOME", re: /(freelance|frilans|buyurtma|loyiha|фриланс|заказ|проект)/ },
  { cat: "Savdo", type: "INCOME", re: /(sotdim|savdo|foyda|sotuv|продал|продаж|выручк|прибыл)/ },
  { cat: "Sovg'a", type: "INCOME", re: /(sovg'a|in'om|tug'ilgan kun|подарок|подарил)/ },
  { cat: "Qo'shimcha ish", type: "INCOME", re: /(qo'shimcha|premiya|bonus|подработк|премия|бонус)/ },
];

/** Kalit so'zlar bo'yicha standart kategoriya nomi; hech biri mos kelmasa null. */
export function guessCategoryByRules(text: string, type: "INCOME" | "EXPENSE"): string | null {
  const n = normalizeText(text);
  for (const r of CATEGORY_RULES) if (r.type === type && r.re.test(n)) return r.cat;
  return null;
}

export function guessCategory(text: string, type: "INCOME" | "EXPENSE"): string {
  return guessCategoryByRules(text, type) ?? (type === "INCOME" ? "Boshqa tushum" : "Boshqa");
}

/* ------------------------------------------------------------------ */
/* Shaxs ismi                                                          */
/* ------------------------------------------------------------------ */

const STOP = new Set([
  "qarz", "qarzga", "pul", "men", "mening", "menga", "dan", "ga", "so'm", "som", "ming", "million", "bugun", "kecha", "ertaga",
  "berdim", "oldim", "oldi", "berdi", "qaytardi", "qaytardim", "долг", "в", "у", "мне", "ему", "ей", "сум", "тысяч", "рублей",
  "bir", "ikki", "uch", "ming", "yuz", "qarzim", "qarzimni", "qarzini", "qarzga", "bugun", "ertaga",
]);

/** "Alisherdan 500 ming qarz oldim" => "Alisher". Taxminiy: bosh harf yoki -dan/-ga qo'shimchasidan. */
export function extractPerson(original: string): string | undefined {
  const cleaned = original.replace(/[‘’ʻʼ`´]/g, "'");
  // 1) Bosh harf bilan boshlanadigan so'z (Alisher, Dilnoza)
  const words = cleaned.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[.,!?:;"]/g, "");
    if (!w || i === 0 && !/(dan|ga|ning|ni|ka|qa)$/i.test(w) && words.length > 1 && !/^[A-ZА-ЯЎҚҒҲ]/u.test(w)) continue;
    if (/^[A-ZА-ЯЎҚҒҲ][\p{L}']{2,}$/u.test(w) && !STOP.has(w.toLowerCase())) {
      return stripSuffix(w);
    }
  }
  // 2) kichik harf bilan: "do'stimdan", "akamga"
  const rel = cleaned.match(/\b([\p{L}']{3,}?)(dan|ga|ka|qa|ning)\s+(?:\d|bir|ikki|uch|to'rt|besh|olti|yetti|sakkiz|to'qqiz|yuz|[\p{L}]+\s+(?:ming|million))/iu);
  if (rel && !STOP.has(rel[1].toLowerCase())) return capitalize(rel[1]);
  // 3) rus: "у Алишера", "Алишеру"
  const ru = cleaned.match(/\b(?:у|ему|ей)\s+([А-ЯЁ][а-яё]+)/u);
  if (ru) return ru[1];
  return undefined;
}
function stripSuffix(w: string): string {
  let out = w;
  const m = out.match(/^(.{3,}?)(dan|ga|ning|ni|ka|qa|dagi|bilan)$/i);
  if (m) out = m[1];
  // Rus: Алишера/Алишеру -> Алишер
  out = out.replace(/(а|у|ом|е)$/u, s => (/[А-Яа-я]/.test(out) && out.length > 4 ? "" : s));
  return capitalize(out);
}
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/* ------------------------------------------------------------------ */
/* Operatsiyalarni ajratish                                            */
/* ------------------------------------------------------------------ */

/** Matnni "va", ",", "keyin", "ham" bo'yicha bo'laklarga bo'ladi, lekin sonlarni buzmaydi. */
export function splitClauses(text: string): string[] {
  const parts = text
    .replace(/\s+(?:keyin|so'ngra|yana|ham|hamda|потом|еще|ещё)\s+/gi, " | ")
    .replace(/(?<=[\p{L}])\s*[,;]\s+/gu, " | ")
    .replace(/\s+(?:va|и)\s+(?=[\p{L}\d]+\s*(?:[\p{L}']+\s+){0,3}(?:\d|bir|ikki|uch|to'rt|besh|olti|yetti|sakkiz|to'qqiz|on|yigirma|o'ttiz|qirq|ellik|oltmish|yetmish|sakson|to'qson|yuz|один|два|три|пять|десять|сто))/giu, " | ")
    .split("|")
    .map(s => s.trim())
    .filter(Boolean);
  // Summasiz bo'laklarni oldingisiga biriktiramiz ("ovqatga 25 ming" + "sarfladim")
  const merged: string[] = [];
  for (const p of parts) {
    if (extractAmounts(p).length === 0 && merged.length) merged[merged.length - 1] += " " + p;
    else merged.push(p);
  }
  return merged;
}

export function classifyClause(clause: string): OpKind | null {
  const n = normalizeText(clause);
  const firstPerson = /(qaytardim\b|qaytarib berdim|qarzimni|вернул долг|погасил долг|отдал долг\b)/.test(n) && !/вернул мне/.test(n);
  if (firstPerson && REPAY_OUT_WORDS.test(n)) return "REPAY_OUT";
  if (REPAY_IN_WORDS.test(n)) return "REPAY_IN";
  if (REPAY_OUT_WORDS.test(n)) return "REPAY_OUT";
  if (BORROW_WORDS.test(n)) return "DEBT_BORROWED";
  if (LENT_WORDS.test(n)) return "DEBT_LENT";
  // "dan ... qarz" kabi yo'nalish: "Alisherdan 500 ming qarz"
  if (/\bqarz/.test(n) || /\bдолг/.test(n)) {
    if (/(oldim|взял|занял|olganman)/.test(n)) return "DEBT_BORROWED";
    if (/(berdim|дал|одолжил|bergan)/.test(n)) return "DEBT_LENT";
  }
  const inc = INCOME_VERBS.test(n), exp = EXPENSE_VERBS.test(n);
  if (inc && !exp) return "INCOME";
  if (exp && !inc) return /maosh|oylik|ish haqi|зарплат/.test(n) ? "INCOME" : "EXPENSE";
  if (inc && exp) return /(maosh|oylik|ish haqi|tushdi|зарплат|пришло|поступил)/.test(n) ? "INCOME" : "EXPENSE";
  return null;
}

/** Matndan operatsiyalar ro'yxatini lokal qoidalar bilan chiqaradi. */
export function parseFinanceText(text: string): ParsedOp[] {
  const ops: ParsedOp[] = [];
  const clauses = splitClauses(text);
  const kinds = clauses.map(c => classifyClause(c));
  for (let ci = 0; ci < clauses.length; ci++) {
    const clause = clauses[ci];
    const amounts = extractAmounts(clause);
    if (!amounts.length) continue;
    // "Avtobusga besh ming, ovqatga yetti ming sarfladim": fe'l faqat oxirgi bo'lakda — qo'shni bo'lakdan olamiz
    // (faqat oddiy xarajat/daromad uchun; qarz yo'nalishini taxmin qilmaymiz).
    let kind = kinds[ci];
    if (!kind) {
      for (let k = ci + 1; k < clauses.length && !kind; k++) if (kinds[k] === "EXPENSE" || kinds[k] === "INCOME") kind = kinds[k];
      if (!kind) for (let k = ci - 1; k >= 0 && !kind; k--) if (kinds[k] === "EXPENSE" || kinds[k] === "INCOME") kind = kinds[k];
    }
    if (!kind) continue;
    const amount = amounts[0].value;
    if (amount <= 0) continue;
    const base = kind === "INCOME" || kind === "EXPENSE";
    const person = base ? undefined : extractPerson(clause);
    ops.push({
      kind,
      amount,
      category: base ? guessCategory(clause, kind as "INCOME" | "EXPENSE") : "",
      note: clause.slice(0, 200),
      person,
      // Qoidaga asoslangan natija AI'dan pastroq ishonchga ega; shaxs ismi bo'lmagan qarz yanada past.
      confidence: base ? 0.7 : person ? 0.7 : 0.4,
    });
  }
  return ops;
}
