/**
 * Eslatmalar (faqat /reminder on qilgan foydalanuvchilarga):
 *  - 09:00 (Toshkent) — muddati bugun kelgan yoki o'tgan qarzlar
 *  - 21:00 (Toshkent) — kunlik xulosa
 * Yuborilgan sana AppSetting'da saqlanadi, shuning uchun bot qayta ishga tushsa ham takror yuborilmaydi.
 */
import type { Bot } from "grammy";
import { formatMoney, toLang, type Lang } from "../src/lib/i18n";
import { CFG } from "./config";
import { todayReport } from "./commands";
import { getSetting, openDebts, prisma, setSetting } from "./store";
import { L, TZ, addDays, fmtDate, htmlEscape, sleep, startOfDay, todayTashkent } from "./util";

const PREFIX = "bot_reminder:";

async function recipients() {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: PREFIX }, value: "on" } });
  const ids = rows.map(r => r.key.slice(PREFIX.length));
  if (!ids.length) return [];
  return prisma.user.findMany({ where: { id: { in: ids }, isBlocked: false, blockedBot: false } });
}

async function send(bot: Bot, user: { id: string; telegramId: string }, text: string) {
  try { await bot.api.sendMessage(user.telegramId, text, { parse_mode: "HTML" }); }
  catch (e) {
    if (e instanceof Error && /blocked|forbidden|deactivated|chat not found/i.test(e.message)) await prisma.user.update({ where: { id: user.id }, data: { blockedBot: true } }).catch(() => {});
    else console.error("[REMINDER] Yuborib bo'lmadi:", e instanceof Error ? e.message : e);
  }
  await sleep(60); // Telegram: ~30 xabar/soniya chegarasi
}

async function runKind(bot: Bot, kind: "debt" | "daily", date: string) {
  for (const user of await recipients()) {
    const key = `bot_reminder_sent:${kind}:${user.id}`;
    if ((await getSetting(key)) === date) continue;
    const lang: Lang = toLang(user.language);
    try {
      if (kind === "daily") {
        await send(bot, user, `🌙 <b>${L(lang, "Kunlik xulosa", "Итоги дня")}</b>\n\n${await todayReport(user.id, lang)}`);
      } else {
        const limit = startOfDay(addDays(date, 1)).getTime();
        const due = (await openDebts(user.id)).filter(d => d.dueAt && d.dueAt.getTime() < limit);
        if (due.length) {
          const lines = due.map(d => `${d.direction === "LENT" ? "↗️" : "↙️"} ${htmlEscape(d.person)} — <b>${formatMoney(d.remaining, lang)}</b> · ${d.dueAt!.getTime() < startOfDay(date).getTime() ? "⏰" : "⏳"} ${fmtDate(d.dueAt!, lang, { day: "2-digit", month: "2-digit" })}`);
          await send(bot, user, `💳 <b>${L(lang, "Qarz muddati eslatmasi", "Напоминание о сроках долгов")}</b>\n\n${lines.join("\n")}`);
        }
      }
      await setSetting(key, date);
    } catch (e) { console.error("[REMINDER] Xato:", e instanceof Error ? e.message : e); }
  }
}

export function startScheduler(bot: Bot): () => void {
  let busy = false;
  const tick = async () => {
    if (busy) return; busy = true;
    try {
      const hour = Number(new Date().toLocaleString("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false })) % 24;
      const date = todayTashkent();
      if (hour === CFG.debtReminderHour) await runKind(bot, "debt", date);
      if (hour === CFG.reminderHour) await runKind(bot, "daily", date);
    } catch (e) { console.error("[REMINDER] Scheduler xatosi:", e instanceof Error ? e.message : e); }
    finally { busy = false; }
  };
  const timer = setInterval(() => void tick(), 60_000);
  return () => clearInterval(timer);
}
