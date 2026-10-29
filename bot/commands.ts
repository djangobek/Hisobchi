/** Buyruqlar, hisobotlar, qarzlar, byudjet, eslatmalar. */
import { Bot, InlineKeyboard } from "grammy";
import { formatMoney, toLang, type Lang } from "../src/lib/i18n";
import { extractAmounts } from "../src/lib/voice-parser";
import { getUser, isMaintenance, langOf, openKeyboard, requireUser } from "./ctx";
import {
  allTimeBalance, budgetKey, budgetStatus, dailyExpenses, delSetting, getSetting, openDebts, prisma, recentTransactions,
  reminderKey, setSetting, sumRange, topCategories,
} from "./store";
import { tx } from "./texts";
import { handleTextInput } from "./voice";
import { L, TZ, addDays, bar, fmtDate, htmlEscape, monthRangeTashkent, startOfDay, todayTashkent } from "./util";

const SEP = "━━━━━━━━━━━━━━━━━━";
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

function startKeyboard(lang: Lang) {
  const url = process.env.WEB_APP_URL;
  const kb = new InlineKeyboard();
  if (url) kb.webApp(tx(lang, "open"), url).row();
  kb.text("🇺🇿 O'zbekcha", "lang:uz").text("🇷🇺 Русский", "lang:ru");
  return kb;
}
const langKeyboard = () => new InlineKeyboard().text("🇺🇿 O'zbekcha", "lang:uz").text("🇷🇺 Русский", "lang:ru");

export async function setMenuButton(bot: Bot, lang: Lang, chatId?: number) {
  const url = process.env.WEB_APP_URL;
  if (!url) return;
  try {
    await bot.api.setChatMenuButton({ ...(chatId ? { chat_id: chatId } : {}), menu_button: { type: "web_app", text: tx(lang, "menuButton"), web_app: { url } } });
  } catch (e) { console.error("setChatMenuButton xatosi:", e); }
}

export async function setupProfile(bot: Bot) {
  try {
    for (const lang of ["uz", "ru"] as const) {
      const opts = lang === "ru" ? { language_code: "ru" as const } : {};
      await bot.api.setMyDescription(tx(lang, "description").replace(/<[^>]*>/g, ""), opts);
      await bot.api.setMyShortDescription(tx(lang, "shortDesc").replace(/<[^>]*>/g, ""), opts);
    }
    await setMenuButton(bot, "uz");
  } catch (e) { console.error("Bot tavsifini o'rnatishda xato:", e); }
  try {
    for (const lang of ["uz", "ru"] as const) {
      const commands = [
        { command: "start", description: tx(lang, "cmdStart") },
        { command: "today", description: tx(lang, "cmdToday") },
        { command: "week", description: L(lang, "Oxirgi 7 kun", "Последние 7 дней") },
        { command: "month", description: tx(lang, "cmdMonth") },
        { command: "balance", description: L(lang, "Umumiy moliyaviy holat", "Общая финансовая картина") },
        { command: "top", description: L(lang, "Eng ko‘p xarajatlar", "Топ расходов") },
        { command: "debts", description: tx(lang, "cmdDebts") },
        { command: "last", description: L(lang, "Oxirgi yozuvlar", "Последние записи") },
        { command: "add", description: L(lang, "Tez qo‘shish", "Быстро добавить") },
        { command: "budget", description: L(lang, "Oylik byudjet limiti", "Месячный лимит") },
        { command: "reminder", description: L(lang, "Kunlik eslatmalar", "Ежедневные напоминания") },
        { command: "app", description: tx(lang, "cmdApp") },
        { command: "help", description: tx(lang, "cmdHelp") },
        { command: "lang", description: tx(lang, "cmdLang") },
      ];
      if (lang === "ru") await bot.api.setMyCommands(commands, { language_code: "ru" });
      else await bot.api.setMyCommands(commands);
    }
  } catch (e) { console.error("setMyCommands xatosi:", e); }
}

/* ---------------- Hisobot matnlari (scheduler ham ishlatadi) ---------------- */

export async function todayReport(userId: string, lang: Lang): Promise<string> {
  const day = todayTashkent();
  const start = startOfDay(day), end = startOfDay(addDays(day, 1));
  const [rows, sums] = await Promise.all([
    prisma.transaction.findMany({ where: { userId, occurredAt: { gte: start, lt: end } }, include: { category: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    sumRange(userId, start, end),
  ]);
  const net = sums.income - sums.expense;
  const list = rows.length
    ? "\n\n" + rows.map(t => `${t.type === "INCOME" ? "🟢" : "🔴"} ${formatMoney(Number(t.amount), lang)} · ${htmlEscape(t.category.name)}${t.note ? ` — ${htmlEscape(t.note.slice(0, 40))}` : ""}`).join("\n") + (sums.count > rows.length ? `\n… +${sums.count - rows.length}` : "")
    : `\n\n<i>${L(lang, "Bugun hali yozuv yo‘q. Ovozli xabar yuboring 🎙", "Сегодня записей пока нет. Отправьте голосовое 🎙")}</i>`;
  return `${tx(lang, "today")} · ${fmtDate(new Date(), lang)}\n${SEP}\n${tx(lang, "income")}: <b>${formatMoney(sums.income, lang)}</b>\n${tx(lang, "expense")}: <b>${formatMoney(sums.expense, lang)}</b>\n${tx(lang, "diff")}: <b>${formatMoney(net, lang)}</b>${list}`;
}

async function monthReport(userId: string, lang: Lang): Promise<string> {
  const { start, end } = monthRangeTashkent();
  const prevStart = (() => { const d = new Date(start.getTime() - 86_400_000); return monthRangeTashkent(d).start; })();
  const [cur, prev, cats, budget, debts] = await Promise.all([
    sumRange(userId, start, end), sumRange(userId, prevStart, start), topCategories(userId, start, end, "EXPENSE", 5), budgetStatus(userId), openDebts(userId),
  ]);
  const net = cur.income - cur.expense;
  const label = start.toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", { month: "long", year: "numeric", timeZone: TZ });
  let out = `📊 <b>${label}</b>\n${SEP}\n${tx(lang, "income")}: <b>${formatMoney(cur.income, lang)}</b>\n${tx(lang, "expense")}: <b>${formatMoney(cur.expense, lang)}</b>\n${tx(lang, "diff")}: <b>${formatMoney(net, lang)}</b>`;
  if (prev.expense > 0) {
    const diff = Math.round(((cur.expense - prev.expense) / prev.expense) * 100);
    out += `\n\n${diff > 0 ? "📈" : "📉"} ${L(lang, `O‘tgan oyga nisbatan xarajat ${Math.abs(diff)}% ${diff > 0 ? "ko‘p" : "kam"}`, `Расходы на ${Math.abs(diff)}% ${diff > 0 ? "больше" : "меньше"}, чем в прошлом месяце`)}`;
  }
  if (cur.income > 0) out += `\n💡 ${L(lang, `Jamg‘arish darajasi: ${Math.max(0, pct(net, cur.income))}%`, `Норма сбережений: ${Math.max(0, pct(net, cur.income))}%`)}`;
  if (cats.length) out += `\n\n<b>${L(lang, "Top xarajatlar", "Топ расходов")}</b>\n` + cats.map(c => `${bar(c.total, cats[0].total, 8)} ${htmlEscape(c.name)} — ${formatMoney(c.total, lang)} (${pct(c.total, cur.expense)}%)`).join("\n");
  if (budget) out += `\n\n🎯 ${L(lang, "Byudjet", "Бюджет")}: ${bar(budget.spent, budget.budget)} ${Math.round(budget.ratio * 100)}%`;
  const lent = debts.filter(d => d.direction === "LENT").reduce((s, d) => s + d.remaining, 0);
  const borrowed = debts.filter(d => d.direction === "BORROWED").reduce((s, d) => s + d.remaining, 0);
  if (lent || borrowed) out += `\n\n💳 ${L(lang, "Qarzlar", "Долги")}: ↗️ ${formatMoney(lent, lang)} · ↙️ ${formatMoney(borrowed, lang)}`;
  return out;
}

/* ---------------- Ro'yxatdan o'tkazish ---------------- */

export function registerCommands(bot: Bot) {
  bot.command("start", async ctx => {
    const lang = await langOf(ctx);
    if (await isMaintenance()) {
      const msg = await prisma.appSetting.findUnique({ where: { key: "maintenance_message" } });
      return ctx.reply(msg?.value ?? tx(lang, "maintenance"));
    }
    const user = await getUser(ctx);
    if (user?.blockedBot) await prisma.user.update({ where: { id: user.id }, data: { blockedBot: false } });
    await ctx.reply(tx(lang, "welcome"), { parse_mode: "HTML", reply_markup: startKeyboard(lang) });
    if (ctx.chat) void setMenuButton(bot, lang, ctx.chat.id);
  });

  bot.command("help", async ctx => { const lang = await langOf(ctx); await ctx.reply(tx(lang, "help"), { parse_mode: "HTML", reply_markup: openKeyboard(lang) }); });
  bot.command("about", async ctx => { const lang = await langOf(ctx); await ctx.reply(tx(lang, "about"), { parse_mode: "HTML", reply_markup: openKeyboard(lang) }); });

  bot.command("app", async ctx => {
    const lang = await langOf(ctx);
    if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
    const kb = openKeyboard(lang);
    if (!kb) return ctx.reply(tx(lang, "noAppUrl"));
    return ctx.reply(tx(lang, "welcome"), { parse_mode: "HTML", reply_markup: kb });
  });

  bot.command("lang", async ctx => { await ctx.reply(tx("uz", "chooseLang"), { parse_mode: "HTML", reply_markup: langKeyboard() }); });

  bot.callbackQuery(/^lang:(uz|ru)$/, async ctx => {
    const lang = toLang(ctx.match[1]);
    const id = ctx.from?.id;
    if (id) {
      await prisma.user.upsert({
        where: { telegramId: String(id) }, update: { language: lang },
        create: { telegramId: String(id), firstName: ctx.from?.first_name, lastName: ctx.from?.last_name, username: ctx.from?.username, language: lang },
      });
    }
    await ctx.answerCallbackQuery({ text: tx(lang, "langSet") });
    if (id) void setMenuButton(bot, lang, id);
    try { await ctx.editMessageText(tx(lang, "welcome"), { parse_mode: "HTML", reply_markup: startKeyboard(lang) }); }
    catch { await ctx.reply(tx(lang, "langSet")); }
  });

  bot.command("admin", async ctx => {
    const lang = await langOf(ctx);
    const user = await getUser(ctx);
    if (!user || user.role !== "ADMIN") return ctx.reply(tx(lang, "noAccess"));
    const url = process.env.WEB_APP_URL;
    if (!url) return ctx.reply(tx(lang, "noWebApp"));
    await ctx.reply(tx(lang, "adminGo"), { reply_markup: new InlineKeyboard().webApp(tx(lang, "adminOpen"), url) });
  });

  bot.command("today", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    await ctx.reply(await todayReport(g.user.id, g.lang), { parse_mode: "HTML" });
  });

  bot.command("month", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    await ctx.reply(await monthReport(g.user.id, g.lang), { parse_mode: "HTML" });
  });

  bot.command("week", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    const { lang } = g;
    const days = await dailyExpenses(g.user.id, 7);
    const max = Math.max(...days.map(d => d.total), 0);
    const total = days.reduce((s, d) => s + d.total, 0);
    const start = startOfDay(days[0].date), end = startOfDay(addDays(days[6].date, 1));
    const [sums, cats] = await Promise.all([sumRange(g.user.id, start, end), topCategories(g.user.id, start, end, "EXPENSE", 3)]);
    const rows = days.map(d => `${fmtDate(`${d.date}T12:00:00+05:00`, lang, { weekday: "short", day: "2-digit", month: "2-digit" })}  ${bar(d.total, max, 8)} ${d.total ? formatMoney(d.total, lang) : "—"}`);
    let out = `📅 <b>${L(lang, "Oxirgi 7 kun", "Последние 7 дней")}</b>\n${SEP}\n<code>${rows.join("\n")}</code>\n\n${tx(lang, "income")}: <b>${formatMoney(sums.income, lang)}</b>\n${tx(lang, "expense")}: <b>${formatMoney(total, lang)}</b>\n📆 ${L(lang, "Kunlik o‘rtacha", "В среднем в день")}: <b>${formatMoney(total / 7, lang)}</b>`;
    if (cats.length) out += `\n\n🏷 ${cats.map(c => `${htmlEscape(c.name)} ${formatMoney(c.total, lang)}`).join(" · ")}`;
    await ctx.reply(out, { parse_mode: "HTML" });
  });

  bot.command("top", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    const { lang } = g; const { start, end } = monthRangeTashkent();
    const [cats, sums] = await Promise.all([topCategories(g.user.id, start, end, "EXPENSE", 8), sumRange(g.user.id, start, end)]);
    if (!cats.length) return void ctx.reply(L(lang, "Bu oy hali xarajat yo‘q.", "В этом месяце расходов пока нет."));
    const lines = cats.map((c, i) => `${["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} ${htmlEscape(c.name)}\n   ${bar(c.total, cats[0].total)} ${formatMoney(c.total, lang)} · ${pct(c.total, sums.expense)}%`);
    await ctx.reply(`🏆 <b>${L(lang, "Bu oy eng ko‘p xarajatlar", "Больше всего трат в этом месяце")}</b>\n${SEP}\n${lines.join("\n")}`, { parse_mode: "HTML" });
  });

  bot.command("balance", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    const { lang } = g; const { start, end } = monthRangeTashkent();
    const [all, month, debts] = await Promise.all([allTimeBalance(g.user.id), sumRange(g.user.id, start, end), openDebts(g.user.id)]);
    const lent = debts.filter(d => d.direction === "LENT").reduce((s, d) => s + d.remaining, 0);
    const borrowed = debts.filter(d => d.direction === "BORROWED").reduce((s, d) => s + d.remaining, 0);
    const bal = all.income - all.expense;
    const out = `💼 <b>${L(lang, "Umumiy holat", "Общая картина")}</b>\n${SEP}\n💰 ${L(lang, "Sof balans (barcha vaqt)", "Чистый баланс (за всё время)")}: <b>${formatMoney(bal, lang)}</b>\n\n📊 ${L(lang, "Shu oy", "Этот месяц")}: 🟢 ${formatMoney(month.income, lang)} · 🔴 ${formatMoney(month.expense, lang)}\n\n💳 ${L(lang, "Qarzlar", "Долги")}\n↗️ ${L(lang, "Sizga qaytishi kerak", "Вам должны")}: <b>${formatMoney(lent, lang)}</b>\n↙️ ${L(lang, "Siz qaytarishingiz kerak", "Вы должны")}: <b>${formatMoney(borrowed, lang)}</b>\n\n🧮 ${L(lang, "Qarzlarni hisobga olgandagi holat", "С учётом долгов")}: <b>${formatMoney(bal + lent - borrowed, lang)}</b>`;
    await ctx.reply(out, { parse_mode: "HTML" });
  });

  bot.command("debts", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    const { lang } = g;
    const rows = await openDebts(g.user.id);
    if (!rows.length) return void ctx.reply(tx(lang, "noDebts"), { reply_markup: openKeyboard(lang) });
    const now = Date.now();
    const section = (dir: "LENT" | "BORROWED") => {
      const list = rows.filter(d => d.direction === dir);
      if (!list.length) return "";
      const total = list.reduce((s, d) => s + d.remaining, 0);
      const lines = list.map(d => {
        const late = d.dueAt && d.dueAt.getTime() < now;
        const due = d.dueAt ? ` · ${late ? "⏰ " : "⏳ "}${fmtDate(d.dueAt, lang, { day: "2-digit", month: "2-digit" })}` : "";
        return `👤 ${htmlEscape(d.person)} — <b>${formatMoney(d.remaining, lang)}</b>${d.remaining < d.original ? ` <i>(${L(lang, "boshida", "было")} ${formatMoney(d.original, lang)})</i>` : ""}${due}`;
      });
      return `${dir === "LENT" ? tx(lang, "lent") : tx(lang, "borrowed")} — <b>${formatMoney(total, lang)}</b>\n${lines.join("\n")}`;
    };
    const out = [`${tx(lang, "debtsTitle")}\n${SEP}`, section("LENT"), section("BORROWED")].filter(Boolean).join("\n\n");
    await ctx.reply(`${out}\n\n🎙 <i>${L(lang, "To‘lovni ovoz bilan kiriting: «Alisher qarzini qaytardi 100 ming»", "Платёж можно продиктовать: «Алишер вернул долг 100 тысяч»")}</i>`, { parse_mode: "HTML" });
  });

  /* ---- /last: oxirgi yozuvlar + o'chirish ---- */
  bot.command("last", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    const { lang } = g;
    const rows = await recentTransactions(g.user.id, 5);
    if (!rows.length) return void ctx.reply(L(lang, "Hali yozuvlar yo‘q.", "Записей пока нет."));
    const kb = new InlineKeyboard();
    const lines = rows.map((t, i) => {
      kb.text(`🗑 ${i + 1}`, `tx:ask:${t.id}`);
      return `<b>${i + 1}.</b> ${t.type === "INCOME" ? "🟢" : "🔴"} <b>${formatMoney(Number(t.amount), lang)}</b> · ${htmlEscape(t.category.name)} · ${fmtDate(t.occurredAt, lang, { day: "2-digit", month: "2-digit" })}${t.note ? `\n   📝 ${htmlEscape(t.note.slice(0, 50))}` : ""}`;
    });
    await ctx.reply(`🕘 <b>${L(lang, "Oxirgi yozuvlar", "Последние записи")}</b>\n${SEP}\n${lines.join("\n")}`, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery(/^tx:(ask|yes|no):([a-z0-9]+)$/, async ctx => {
    const lang = await langOf(ctx);
    const user = await getUser(ctx);
    const [, step, id] = ctx.match;
    if (!user) return void ctx.answerCallbackQuery();
    const row = await prisma.transaction.findFirst({ where: { id, userId: user.id }, include: { category: { select: { name: true } } } });
    if (step === "no") { await ctx.answerCallbackQuery({ text: L(lang, "Bekor qilindi", "Отменено") }); return void ctx.deleteMessage().catch(() => {}); }
    if (!row) return void ctx.answerCallbackQuery({ text: L(lang, "Yozuv topilmadi (allaqachon o‘chirilgan).", "Запись не найдена (уже удалена)."), show_alert: true });
    if (step === "ask") {
      await ctx.answerCallbackQuery();
      return void ctx.reply(`❓ ${L(lang, "O‘chirilsinmi?", "Удалить?")}\n${row.type === "INCOME" ? "🟢" : "🔴"} <b>${formatMoney(Number(row.amount), lang)}</b> · ${htmlEscape(row.category.name)}`, {
        parse_mode: "HTML", reply_markup: new InlineKeyboard().text(L(lang, "🗑 Ha, o‘chirish", "🗑 Да, удалить"), `tx:yes:${id}`).text(L(lang, "Yo‘q", "Нет"), `tx:no:${id}`),
      });
    }
    await prisma.transaction.deleteMany({ where: { id, userId: user.id } });
    await ctx.answerCallbackQuery({ text: L(lang, "O‘chirildi", "Удалено") });
    await ctx.editMessageText(`🗑 ${L(lang, "O‘chirildi", "Удалено")}: ${formatMoney(Number(row.amount), lang)} · ${htmlEscape(row.category.name)}`, { parse_mode: "HTML" }).catch(() => {});
  });

  /* ---- /add: yo'riqnoma yoki to'g'ridan-to'g'ri matn ---- */
  bot.command("add", async ctx => {
    const lang = await langOf(ctx);
    const arg = ctx.match?.toString().trim();
    if (arg && extractAmounts(arg).length) return handleTextInput(ctx, arg);
    await ctx.reply(L(lang,
      "➕ <b>Tez qo‘shish</b>\n\nOvozli xabar yuboring yoki oddiy yozing:\n\n🔴 «ovqatga 25 ming»\n🔴 «taksiga 18000, bozorga 120 ming»\n🟢 «ish haqim 3 million tushdi»\n📥 «Alisherdan 500 ming qarz oldim»\n📤 «Boburga 300 ming qarz berdim»\n✅ «Dilnoza qarzini qaytardi 100 ming»\n\nBot har birini ajratib, tasdiqlashingiz uchun ko‘rsatadi.",
      "➕ <b>Быстрое добавление</b>\n\nОтправьте голосовое или просто напишите:\n\n🔴 «на еду 25 тысяч»\n🔴 «такси 18000, рынок 120 тысяч»\n🟢 «пришла зарплата 3 миллиона»\n📥 «занял у Алишера 500 тысяч»\n📤 «дал в долг Бобуру 300 тысяч»\n✅ «Дилноза вернула долг 100 тысяч»\n\nБот разберёт каждую запись и покажет для подтверждения."),
      { parse_mode: "HTML" });
  });

  /* ---- /budget ---- */
  bot.command("budget", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    const { lang, user } = g;
    const arg = ctx.match?.toString().trim().toLowerCase() ?? "";
    if (["off", "o'chir", "ochir", "выкл", "0"].includes(arg)) { await delSetting(budgetKey(user.id)); return void ctx.reply(L(lang, "🎯 Byudjet limiti o‘chirildi.", "🎯 Лимит бюджета отключён.")); }
    if (arg) {
      const amount = extractAmounts(arg)[0]?.value ?? Number(arg.replace(/\D/g, ""));
      if (!amount || amount <= 0 || amount > 1e12) return void ctx.reply(L(lang, "Summani to‘g‘ri kiriting. Masalan: /budget 3000000", "Введите корректную сумму. Например: /budget 3000000"));
      await setSetting(budgetKey(user.id), String(Math.round(amount)));
      return void ctx.reply(L(lang, `🎯 Oylik byudjet: <b>${formatMoney(amount, lang)}</b>\n80% va 100% ga yetganda ogohlantiraman.`, `🎯 Месячный бюджет: <b>${formatMoney(amount, lang)}</b>\nПредупрежу при достижении 80% и 100%.`), { parse_mode: "HTML" });
    }
    const b = await budgetStatus(user.id);
    if (!b) return void ctx.reply(L(lang, "🎯 Oylik byudjet belgilanmagan.\n\nO‘rnatish: <code>/budget 3000000</code>", "🎯 Месячный бюджет не задан.\n\nУстановить: <code>/budget 3000000</code>"), { parse_mode: "HTML" });
    await ctx.reply(`🎯 <b>${L(lang, "Oylik byudjet", "Месячный бюджет")}</b>\n${bar(b.spent, b.budget)} ${Math.round(b.ratio * 100)}%\n${L(lang, "Sarflandi", "Потрачено")}: ${formatMoney(b.spent, lang)} / ${formatMoney(b.budget, lang)}\n${b.budget >= b.spent ? `${L(lang, "Qoldi", "Осталось")}: <b>${formatMoney(b.budget - b.spent, lang)}</b>` : `🚨 ${L(lang, "Oshdi", "Превышено на")}: <b>${formatMoney(b.spent - b.budget, lang)}</b>`}\n\n<i>/budget off — ${L(lang, "o‘chirish", "отключить")}</i>`, { parse_mode: "HTML" });
  });

  /* ---- /reminder ---- */
  bot.command("reminder", async ctx => {
    const g = await requireUser(ctx); if (!g) return;
    const { lang, user } = g;
    const arg = ctx.match?.toString().trim().toLowerCase() ?? "";
    const cur = (await getSetting(reminderKey(user.id))) === "on";
    const on = ["on", "yoq", "yoqish", "вкл"].includes(arg), off = ["off", "ochir", "o'chir", "выкл"].includes(arg);
    if (on) await setSetting(reminderKey(user.id), "on"); else if (off) await delSetting(reminderKey(user.id));
    const now = on ? true : off ? false : cur;
    await ctx.reply(now
      ? L(lang, `🔔 Eslatmalar <b>yoqilgan</b>.\n• Har kuni soat 09:00 — muddati kelgan qarzlar\n• Har kuni soat 21:00 — kunlik xulosa\n\n<i>/reminder off — o‘chirish</i>`, `🔔 Напоминания <b>включены</b>.\n• Ежедневно в 09:00 — долги со сроком\n• Ежедневно в 21:00 — итоги дня\n\n<i>/reminder off — отключить</i>`)
      : L(lang, "🔕 Eslatmalar o‘chiq.\n\nYoqish: <code>/reminder on</code>", "🔕 Напоминания отключены.\n\nВключить: <code>/reminder on</code>"), { parse_mode: "HTML" });
  });
}
