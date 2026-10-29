/**
 * Matndan moliyaviy operatsiyalarni ajratish (NLU).
 * Zanjir: Gemini (bir nechta model) → Groq → lokal qoidalar (src/lib/voice-parser.ts).
 * LLM natijasi lokal parser bilan o'zaro tekshiriladi: matnda yo'q summa "gallyutsinatsiya" deb belgilanadi.
 */
import { CFG } from "./config";
import { addDays, todayTashkent } from "./util";
import { extractAmounts, parseFinanceText, type OpKind } from "../src/lib/voice-parser";
import { findOther, resolveCategory, type CatInfo } from "../src/lib/category-match";

export type DraftOp = {
  kind: OpKind;
  amount: number;
  category: string;
  note: string;
  person?: string;
  date: string;       // YYYY-MM-DD
  dueDate?: string;   // qarz muddati
  confidence: number;
  warn?: string;      // foydalanuvchiga ko'rsatiladigan ogohlantirish kodi
  catFallback?: boolean; // mos kategoriya topilmadi — "Boshqa" qo'yildi
};

export type NluContext = {
  /** Foydalanuvchining MAVJUD kategoriyalari (bot yangisini o'ylab topmaydi). */
  categories: CatInfo[];
  expenseCategories: string[];
  incomeCategories: string[];
  knownPeople: string[];
};

export type NluResult = { ops: DraftOp[]; uncertain: number; engine: "gemini" | "groq" | "local" };

const KINDS: OpKind[] = ["INCOME", "EXPENSE", "DEBT_LENT", "DEBT_BORROWED", "REPAY_IN", "REPAY_OUT"];
const cooldown = new Map<string, number>();
const hot = (k: string) => (cooldown.get(k) ?? 0) > Date.now();
const trip = (k: string) => cooldown.set(k, Date.now() + CFG.providerCooldownMs);

class LlmError extends Error { constructor(m: string, public status?: number) { super(m); } }
export class TooManyOpsError extends Error {}

function buildPrompt(transcript: string, ctx: NluContext): string {
  const today = todayTashkent();
  return `Sen o'zbek va rus tilini mukammal biladigan moliyaviy yordamchisan. Quyidagi nutq/matndan HAR BIR alohida moliyaviy operatsiyani ajrat.

OPERATSIYA TURLARI (kind):
- EXPENSE: pul sarfladi (sotib oldim, to'ladim, sarfladim, ketdi).
- INCOME: o'ziga pul tushdi (maosh, ish haqi, topdim, sotdim, sovg'a pul).
- DEBT_BORROWED: BOSHQADAN qarz OLDI ("Alisherdan 500 ming qarz oldim", "qarzga oldim", "занял у ...").
- DEBT_LENT: BOSHQAGA qarz BERDI ("Bobur akaga 300 ming qarz berdim", "дал в долг ...").
- REPAY_IN: boshqa odam o'z qarzini QAYTARDI ("Dilnoza qarzini qaytardi").
- REPAY_OUT: u o'z qarzini boshqaga QAYTARDI ("Alisherga qarzimni qaytardim").

QOIDALAR:
- Har bir summa faqat o'ziga tegishli bo'lsin; summalarni birlashtirma va birortasini tashlab ketma.
- O'zbek sonlari: besh ming=5000, yetti yuz ming=700000, bir yarim million=1500000, ikki yuz ellik ming=250000, 25k=25000. Rus: пятьсот тысяч=500000.
- Qarz operatsiyalari (DEBT_*, REPAY_*) uchun "person" majburiy: faqat ISM (qo'shimchasiz: "Alisherdan" → "Alisher"). Ism bo'lmasa, "person" ni bo'sh qoldir va confidence ni 0.4 dan oshirma.
- Ma'lum ismlar: ${ctx.knownPeople.length ? ctx.knownPeople.slice(0, 40).join(", ") : "yo'q"}. Agar nutqdagi ism shularga o'xshasa, aynan shu yozuvni ishlat.
- KATEGORIYA (juda muhim): category FAQAT foydalanuvchining quyidagi mavjud ro'yxatidan, harfma-harf bir xil yozilgan holda tanlanadi. Yangi nom O'YLAB TOPMA, tarjima qilma, o'zgartirma.
  • EXPENSE kategoriyalari: ${ctx.expenseCategories.map(n => JSON.stringify(n)).join(", ")}
  • INCOME kategoriyalari: ${ctx.incomeCategories.map(n => JSON.stringify(n)).join(", ")}
  • Ma'nosi bo'yicha eng mosini tanla (masalan taksi/benzin → transportga oid kategoriya, go'sht/non → oziq-ovqatga oid kategoriya, maosh → ish haqiga oid kategoriya).
  • Hech biri aniq mos kelmasa EXPENSE uchun ${JSON.stringify(findOther("EXPENSE", ctx.categories).name)}, INCOME uchun ${JSON.stringify(findOther("INCOME", ctx.categories).name)} ni qo'y.
- Qarz operatsiyalarida category bo'sh bo'lsin.
- Kontekst noaniq bo'lsa amount ni 0 qil va confidence ni past qo'y — taxmin qilma.
- Kelajak rejalar, savollar, oddiy gaplar operatsiya EMAS.
- date: YYYY-MM-DD ("kecha"=${addDays(today, -1)}, "bugun"=${today}); aytilmasa ${today}.
- due_date: faqat qarz uchun va muddat aytilgan bo'lsa ("bir haftaga" = ${addDays(today, 7)}, "oy oxirigacha"); aks holda bo'sh.
- note: qisqa izoh (nima uchun), 60 belgidan oshmasin.
- confidence: 0..1.

Faqat JSON massiv qaytar: [{"kind":"EXPENSE","amount":5000,"category":"Transport","note":"Avtobus","person":"","date":"${today}","due_date":"","confidence":0.95}]

Bugungi sana: ${today}
Nutq: ${JSON.stringify(transcript)}`;
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LlmError("Gemini API key sozlanmagan");
  let last: unknown;
  for (const model of CFG.geminiModels) {
    if (hot(`gemini:${model}`)) continue;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0, responseMimeType: "application/json",
            responseSchema: { type: "ARRAY", items: { type: "OBJECT", properties: {
              kind: { type: "STRING", enum: KINDS }, amount: { type: "NUMBER" }, category: { type: "STRING" },
              note: { type: "STRING" }, person: { type: "STRING" }, date: { type: "STRING" }, due_date: { type: "STRING" }, confidence: { type: "NUMBER" },
            }, required: ["kind", "amount", "category", "note", "date", "confidence"] } },
          },
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) {
        if ([400, 401, 403, 404, 429].includes(res.status)) trip(`gemini:${model}`);
        throw new LlmError(`Gemini(${model}) HTTP ${res.status}: ${data?.error?.message || "API xatosi"}`, res.status);
      }
      const c = data?.candidates?.[0];
      const text = c?.content?.parts?.map((p: any) => p.text || "").join("").trim();
      if (!text) throw new LlmError(`Gemini(${model}) bo'sh javob (${c?.finishReason || "no candidate"})`);
      return text;
    } catch (e) { last = e; console.warn(`[NLU] ${e instanceof Error ? e.message : e}`); }
  }
  throw last instanceof Error ? last : new LlmError("Gemini ishlamadi");
}

async function callGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new LlmError("Groq API key sozlanmagan");
  if (hot("groq")) throw new LlmError("Groq vaqtincha o'tkazib yuborildi");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: CFG.groqModel, temperature: 0, max_completion_tokens: 2048, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: 'Moliyaviy operatsiyalarni ajrat. Faqat JSON qaytar: {"operations":[...]}. Barcha operatsiyalarni saqla.' },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    if ([401, 403, 429].includes(res.status)) trip("groq");
    throw new LlmError(`Groq HTTP ${res.status}: ${data?.error?.message || "API xatosi"}`, res.status);
  }
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new LlmError("Groq bo'sh javob qaytardi");
  return text;
}

export function parseJsonRows(text: string): any[] {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = JSON.parse(cleaned);
  const rows = Array.isArray(parsed) ? parsed : parsed?.operations;
  if (!Array.isArray(rows)) throw new Error("AI JSON ichida operations massivi yo'q");
  return rows;
}

function validIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? value : fallback;
}

const DEFAULT_CAT = { INCOME: "Boshqa tushum", EXPENSE: "Boshqa" } as const;

/** AI qaytargan qatorlarni tozalab, tekshiradi. */
export function normalizeRows(rows: any[], transcript: string, ctx?: NluContext): { ops: DraftOp[]; uncertain: number } {
  const today = todayTashkent();
  const spans = extractAmounts(transcript).map(s => s.value);
  const ops: DraftOp[] = []; let uncertain = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") { uncertain++; continue; }
    const kind = (row.kind ?? row.type) as OpKind;
    const amount = typeof row.amount === "number" ? row.amount : Number(row.amount);
    let confidence = typeof row.confidence === "number" ? Math.max(0, Math.min(1, row.confidence)) : 0;
    if (!KINDS.includes(kind) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) { uncertain++; continue; }
    const isDebt = kind !== "INCOME" && kind !== "EXPENSE";
    const person = typeof row.person === "string" ? row.person.trim().slice(0, 60) : "";
    let warn: string | undefined;
    // O'zaro tekshiruv: matnda aniqlangan summalar ichida yo'q bo'lsa — shubhali
    if (spans.length && !spans.includes(Math.round(amount))) { confidence *= 0.8; warn = "amount"; }
    if (isDebt && !person) { confidence = Math.min(confidence, 0.4); warn = "person"; }
    if (confidence < CFG.minConfidence) { uncertain++; continue; }
    const category = typeof row.category === "string" ? row.category.trim().slice(0, 60) : "";
    const note = typeof row.note === "string" ? row.note.trim().slice(0, 240) : "";
    let finalCategory = isDebt ? "" : category || DEFAULT_CAT[kind as "INCOME" | "EXPENSE"];
    let catFallback = false;
    if (!isDebt && ctx) {
      // AI nomi mavjud kategoriyalarga moslanadi; topilmasa "Boshqa" (yangi kategoriya yaratilmaydi)
      const m = resolveCategory(category, kind as "INCOME" | "EXPENSE", ctx.categories, note);
      finalCategory = m.name; catFallback = m.how === "other";
    }
    const due = typeof row.due_date === "string" && row.due_date ? validIsoDate(row.due_date, "") : "";
    ops.push({
      kind, amount: Math.round(amount * 100) / 100,
      category: finalCategory, catFallback: catFallback || undefined,
      note: note || transcript.slice(0, 120),
      person: isDebt ? person : undefined,
      date: validIsoDate(row.date, today),
      dueDate: isDebt && due ? due : undefined,
      confidence, warn,
    });
  }
  return { ops, uncertain };
}

/** Lokal qoidalar bilan zaxira natija. */
function localFallback(transcript: string, ctx?: NluContext): { ops: DraftOp[]; uncertain: number } {
  const today = todayTashkent();
  const parsed = parseFinanceText(transcript);
  const ops: DraftOp[] = []; let uncertain = 0;
  for (const p of parsed) {
    const isDebt = p.kind !== "INCOME" && p.kind !== "EXPENSE";
    if (isDebt && !p.person) { uncertain++; continue; }
    let category = p.category, catFallback = false;
    if (!isDebt && ctx) {
      const m = resolveCategory(p.category, p.kind as "INCOME" | "EXPENSE", ctx.categories, p.note);
      category = m.name; catFallback = m.how === "other";
    }
    ops.push({ kind: p.kind, amount: p.amount, category, catFallback: catFallback || undefined, note: p.note, person: p.person, date: today, confidence: p.confidence, warn: "local" });
  }
  return { ops, uncertain };
}

export async function extractOperations(transcript: string, ctx: NluContext): Promise<NluResult> {
  const prompt = buildPrompt(transcript, ctx);
  const attempts: { engine: "gemini" | "groq"; run: () => Promise<string> }[] = [
    { engine: "gemini", run: () => callGemini(prompt) },
    { engine: "groq", run: () => callGroq(prompt) },
  ];
  for (const a of attempts) {
    try {
      let raw = await a.run();
      let rows: any[];
      try { rows = parseJsonRows(raw); }
      catch {
        // JSON buzilgan bo'lsa shu provayderga bir marta qat'iy format bilan qayta so'raymiz
        raw = await (a.engine === "gemini" ? callGemini(prompt + "\nFAQAT toza JSON massiv.") : callGroq(prompt + "\nFAQAT toza JSON."));
        rows = parseJsonRows(raw);
      }
      if (rows.length > CFG.maxOpsPerMessage) throw new TooManyOpsError(`Bir xabarda ${CFG.maxOpsPerMessage} tadan ortiq operatsiya`);
      const { ops, uncertain } = normalizeRows(rows, transcript, ctx);
      if (ops.length || uncertain) return { ops, uncertain, engine: a.engine };
      // AI hech narsa topmadi — lokal parser bilan tekshirib ko'ramiz (AI ba'zan o'tkazib yuboradi)
      const local = localFallback(transcript, ctx);
      return local.ops.length ? { ...local, engine: "local" } : { ops: [], uncertain: 0, engine: a.engine };
    } catch (e) {
      if (e instanceof TooManyOpsError) throw e;
      console.warn(`[NLU] ${a.engine} muvaffaqiyatsiz: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.warn("[NLU] AI mavjud emas; lokal parser ishlatilmoqda.");
  return { ...localFallback(transcript, ctx), engine: "local" };
}
