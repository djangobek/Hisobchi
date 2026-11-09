import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Bot, Context } from "grammy";
import { prisma, sumRange } from "./store";
import { startOfDay, todayTashkent } from "./util";

/**
 * Oylik moliyaviy widget (Telegram Bot API 10.4 beta).
 * Faqat: daromad, xarajat va ularning farqi. Oylar o'rtasida ‹ › tugmalari bilan o'tiladi.
 */
type MonthState = {
  m: string;   // "YYYY-MM"
  i: number;   // oylik daromad
  e: number;   // oylik xarajat
  pv: string;  // oldingi oy kaliti ("" — undan oldin ma'lumot yo'q)
  nx: string;  // keyingi oy kaliti ("" — joriy oy)
};

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const token = () => process.env.BOT_TOKEN ?? "";
const enabled = () => process.env.WIDGETS_ENABLED === "true";
const apiRoot = () => (process.env.TELEGRAM_BOT_API_BASE_URL || "https://api.telegram.org/beta").replace(/\/+$/, "");
const p2 = (n: number) => String(n).padStart(2, "0");

async function telegramCall<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  if (!token()) throw new Error("BOT_TOKEN sozlanmagan.");
  const response = await fetch(`${apiRoot()}/bot${token()}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json() as { ok: boolean; result?: T; description?: string };
  if (!response.ok || !body.ok) throw new Error(body.description || `Telegram ${method} so‘rovi bajarilmadi.`);
  return body.result as T;
}

const readWidget = (name: string) => readFile(path.join(process.cwd(), "bot", "widgets", name), "utf8");

function jsonSized(value: unknown, limit = 1024) {
  const s = JSON.stringify(value);
  if (Buffer.byteLength(s, "utf8") > limit) throw new Error("Widget ma’lumoti 1024 bayt limitidan oshdi.");
  return s;
}

const keyOf = (y: number, m: number) => `${y}-${p2(m)}`;
const shiftMonth = (y: number, m: number, d: number) => {
  const t = y * 12 + (m - 1) + d;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
};
/** Toshkent bo'yicha oy chegaralari [start, end). */
function monthBounds(y: number, m: number) {
  const n = shiftMonth(y, m, 1);
  return { start: startOfDay(`${y}-${p2(m)}-01`), end: startOfDay(`${n.y}-${p2(n.m)}-01`) };
}

/** "cur" yoki "YYYY-MM" → haqiqiy oy. Kelajak oylar va noto'g'ri qiymatlar joriy oyga/null ga aylanadi. */
function resolveMonth(raw: string) {
  const [cy, cm] = todayTashkent().split("-").map(Number);
  if (raw === "cur") return { y: cy, m: cm, cy, cm };
  const match = MONTH_KEY.exec(raw);
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]);
  if (y < 2000 || y * 12 + m > cy * 12 + cm) return null;
  return { y, m, cy, cm };
}

async function monthState(userId: string, raw: string): Promise<MonthState | null> {
  const r = resolveMonth(raw);
  if (!r) return null;
  const { start, end } = monthBounds(r.y, r.m);
  const [sums, earlier] = await Promise.all([
    sumRange(userId, start, end),
    prisma.transaction.findFirst({ where: { userId, occurredAt: { lt: start } }, select: { id: true } }),
  ]);
  const prev = shiftMonth(r.y, r.m, -1), next = shiftMonth(r.y, r.m, 1);
  const hasNext = next.y * 12 + next.m <= r.cy * 12 + r.cm;
  return {
    m: keyOf(r.y, r.m),
    i: Math.round(sums.income),
    e: Math.round(sums.expense),
    pv: earlier ? keyOf(prev.y, prev.m) : "",
    nx: hasNext ? keyOf(next.y, next.m) : "",
  };
}

export async function sendDashboard(chatId: number) {
  if (!enabled()) throw new Error("Widget funksiyalari yoqilmagan. WIDGETS_ENABLED=true sozlang.");
  const html = await readWidget("dashboard.html");
  // MAXFIYLIK: xabar holatiga (chat_data) moliyaviy raqam yozilmaydi — widget ma'lumotni
  // har safar ko'ruvchining o'z Telegram ID'si bo'yicha `widget_query` orqali oladi.
  return telegramCall<{ message_id: number; chat: { id: number } }>("sendWidget", {
    chat_id: chatId, html, width: 380, height: 0, allow_queries: true,
    chat_data: jsonSized({ v: 1 }), caption: "📊 Oylik hisobot",
  });
}

const answer = (queryId: string, result: unknown) =>
  telegramCall<boolean>("answerWidgetQuery", { widget_query_id: queryId, data: jsonSized(result) });

async function handleWidgetQuery(q: any) {
  const tgId = q.from?.id;
  if (!tgId || !q.id || typeof q.data !== "string") return;
  const user = await prisma.user.findUnique({ where: { telegramId: String(tgId) } });
  if (!user || user.isBlocked) return void await answer(q.id, { ok: false, message: "Hisobchi hisobingiz topilmadi yoki bloklangan." });
  if (!q.data.startsWith("m:")) return void await answer(q.id, { ok: false, message: "So‘rov formati noto‘g‘ri." });
  const state = await monthState(user.id, q.data.slice(2));
  if (!state) return void await answer(q.id, { ok: false, message: "Noto‘g‘ri oy." });
  await answer(q.id, { ok: true, state });
}

async function openDashboard(ctx: Context) {
  if (ctx.chat?.type !== "private") return void await ctx.reply("Moliyaviy hisobot maxfiylik uchun faqat bot bilan shaxsiy chatda ishlaydi.");
  const tgId = ctx.from?.id;
  const user = tgId ? await prisma.user.findUnique({ where: { telegramId: String(tgId) } }) : null;
  if (!user || user.isBlocked) return void await ctx.reply("Hisobchi hisobingiz topilmadi. Avval /start buyrug‘ini yuboring.");
  try { await sendDashboard(ctx.chat.id); }
  catch (e) { await ctx.reply(e instanceof Error ? e.message : "Hisobot ochilmadi."); }
}

export function registerWidgetHandlers(bot: Bot) {
  bot.command("dashboard", openDashboard);
  bot.callbackQuery("widget:dashboard", async ctx => { await ctx.answerCallbackQuery().catch(() => {}); await openDashboard(ctx); });
  bot.use(async (ctx, next) => {
    const update = ctx.update as any;
    try {
      if (update.widget_query) return await handleWidgetQuery(update.widget_query);
      if (update.shared_widget_query) return await answer(update.shared_widget_query.id, { ok: false, message: "Ulashilgan widget shaxsiy moliya uchun qo‘llanmaydi." });
    } catch (error) {
      console.error("Widget handler error:", error);
      const q = update.widget_query ?? update.shared_widget_query;
      if (q?.id) await answer(q.id, { ok: false, message: "Xatolik yuz berdi. Qayta urinib ko‘ring." }).catch(() => {});
      return;
    }
    await next();
  });
}
