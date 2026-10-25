import { Bot, InlineKeyboard } from "grammy";
import { PrismaClient } from "@prisma/client";
import { monthBounds } from "../src/lib/dates";
import { formatMoney, langFromTelegram, localeOf, toLang, type Lang } from "../src/lib/i18n";

const token = process.env.BOT_TOKEN;
if (!token) { console.error("BOT_TOKEN .env faylida ko'rsatilmagan."); process.exit(1); }

const bot = new Bot(token);
const prisma = new PrismaClient();

/** Bot matnlari: uz / ru. */
const TXT = {
  maintenance: { uz: "🛠 Texnik ishlar ketmoqda.", ru: "🛠 Идут технические работы." },
  open: { uz: "Hisobimni ochish", ru: "Открыть мой счёт" },
  welcome: {
    uz: "Assalomu alaykum! 👋\n\nHisobchi — daromad, xarajat va qarzlaringizni tartib bilan yuritish uchun shaxsiy moliya yordamchisi.\n\nMini App'ni ochib, moliyaviy qaydlaringizni boshqaring.",
    ru: "Здравствуйте! 👋\n\nХисобчи — личный финансовый помощник для учёта доходов, расходов и долгов.\n\nОткройте Mini App и ведите свои финансовые записи.",
  },
  noAccess: { uz: "Ruxsat yo'q.", ru: "Нет доступа." },
  noWebApp: { uz: "WEB_APP_URL sozlanmagan.", ru: "WEB_APP_URL не настроен." },
  adminGo: { uz: "🛡 Admin panelga o'tish:", ru: "🛡 Переход в админ-панель:" },
  adminOpen: { uz: "Admin panelni ochish", ru: "Открыть админ-панель" },
  noUser: { uz: "Avval Mini App'ni ochib, hisobingizni yarating.", ru: "Сначала откройте Mini App и создайте свой счёт." },
  today: { uz: "📅 Bugungi hisobot", ru: "📅 Отчёт за сегодня" },
  income: { uz: "🟢 Tushum", ru: "🟢 Доход" },
  expense: { uz: "🔴 Xarajat", ru: "🔴 Расход" },
  diff: { uz: "⚖️ Farq", ru: "⚖️ Разница" },
  noDebts: { uz: "Hozircha ochiq qarzlar yo'q.", ru: "Открытых долгов пока нет." },
  debtsTitle: { uz: "💳 Ochiq qarzlar", ru: "💳 Открытые долги" },
  lent: { uz: "↗️ Bergan", ru: "↗️ Дал" },
  borrowed: { uz: "↙️ Olgan", ru: "↙️ Взял" },
  chooseLang: { uz: "🌐 Tilni tanlang / Выберите язык", ru: "🌐 Tilni tanlang / Выберите язык" },
  langSet: { uz: "✅ Til o'zgartirildi: O'zbekcha", ru: "✅ Язык изменён: Русский" },
  cmdStart: { uz: "Botni ishga tushirish", ru: "Запустить бота" },
  cmdToday: { uz: "Bugungi hisobot", ru: "Отчёт за сегодня" },
  cmdMonth: { uz: "Joriy oy hisoboti", ru: "Отчёт за текущий месяц" },
  cmdDebts: { uz: "Ochiq qarzlar", ru: "Открытые долги" },
  cmdLang: { uz: "Tilni o'zgartirish", ru: "Сменить язык" },
  cmdHelp: { uz: "Yordam va imkoniyatlar", ru: "Помощь и возможности" },
  cmdAbout: { uz: "Bot haqida", ru: "О боте" },
  cmdApp: { uz: "Ilovani ochish", ru: "Открыть приложение" },
  menuButton: { uz: "📱 Ilovani ochish", ru: "📱 Открыть приложение" },
  shortDesc: {
    uz: "Daromad, xarajat va qarzlarni yuritish, AI moliyaviy maslahatchi.",
    ru: "Учёт доходов, расходов и долгов, ИИ-помощник по финансам.",
  },
  description: {
    uz: "💼 Hisobchi — shaxsiy moliya yordamchisi.\n\n• Daromad va xarajatlarni kategoriyalar bo'yicha yuriting\n• Qarzlarni (bergan/olgan) va qaytarilgan to'lovlarni kuzating\n• Oylik hisobot, kalendar va diagrammalar\n• 🤖 AI maslahatchi: tahlil, tejash rejasi, maqsadlar\n• 🇺🇿 O'zbek va 🇷🇺 rus tillari\n\nBoshlash uchun «Start» tugmasini bosing.",
    ru: "💼 Хисобчи — помощник по личным финансам.\n\n• Ведите доходы и расходы по категориям\n• Следите за долгами (дал/взял) и возвратами\n• Месячный отчёт, календарь и диаграммы\n• 🤖 ИИ-помощник: анализ, план накоплений, цели\n• 🇺🇿 Узбекский и 🇷🇺 русский языки\n\nНажмите «Start», чтобы начать.",
  },
  help: {
    uz: "ℹ️ Hisobchi — buyruqlar\n\n📱 /app — ilovani ochish\n📅 /today — bugungi hisobot\n📊 /month — joriy oy hisoboti\n💳 /debts — ochiq qarzlar\n🌐 /lang — tilni o'zgartirish\nℹ️ /about — bot haqida\n\nBarcha yozuvlarni (daromad, xarajat, qarz, maqsad) qo'shish va AI maslahatchi — «Ilovani ochish» tugmasi orqali.",
    ru: "ℹ️ Хисобчи — команды\n\n📱 /app — открыть приложение\n📅 /today — отчёт за сегодня\n📊 /month — отчёт за месяц\n💳 /debts — открытые долги\n🌐 /lang — сменить язык\nℹ️ /about — о боте\n\nДобавление записей (доход, расход, долг, цель) и ИИ-помощник — через кнопку «Открыть приложение».",
  },
  about: {
    uz: "💼 Hisobchi haqida\n\nHisobchi — Telegram Mini App ko'rinishidagi shaxsiy moliya tizimi.\n\n✅ Daromad va xarajatlar, kategoriyalar\n✅ Qarzlar: kim qancha bergan/olgan, qisman to'lovlar, muddatlar\n✅ Oylik statistika, kalendar, diagramma\n✅ AI maslahatchi: xarajat tahlili, kunlik limit, prognoz, moliyaviy ball, maqsadlar\n✅ Ma'lumotlar serverda xavfsiz saqlanadi, faqat o'zingiz ko'rasiz\n✅ O'zbek va rus tillari\n\nBot orqali tezkor hisobotlar: /today, /month, /debts.",
    ru: "💼 О Хисобчи\n\nХисобчи — система личных финансов в формате Telegram Mini App.\n\n✅ Доходы и расходы, категории\n✅ Долги: кто сколько дал/взял, частичные платежи, сроки\n✅ Месячная статистика, календарь, диаграмма\n✅ ИИ-помощник: анализ расходов, дневной лимит, прогноз, финансовый балл, цели\n✅ Данные надёжно хранятся на сервере, видите их только вы\n✅ Узбекский и русский языки\n\nБыстрые отчёты в боте: /today, /month, /debts.",
  },
  unknown: {
    uz: "Savol yoki yozuv uchun ilovani oching 👇 Buyruqlar ro'yxati: /help",
    ru: "Для записей и вопросов откройте приложение 👇 Список команд: /help",
  },
  noAppUrl: { uz: "Ilova manzili (WEB_APP_URL) sozlanmagan.", ru: "Адрес приложения (WEB_APP_URL) не настроен." },
} as const;
const tx = (lang: Lang, key: keyof typeof TXT) => TXT[key][lang];

async function getUser(ctx: any) {
  const id = ctx.from?.id;
  if (!id) return null;
  return prisma.user.findUnique({ where: { telegramId: String(id) } });
}

/** Til: foydalanuvchining saqlangan tili; hisob hali yo'q bo'lsa — Telegram tili. */
async function langOf(ctx: any): Promise<Lang> {
  const user = await getUser(ctx);
  return user ? toLang(user.language) : langFromTelegram(ctx.from?.language_code);
}

async function isMaintenance() {
  const s = await prisma.appSetting.findUnique({ where: { key: "maintenance_mode" } });
  return s?.value === "true";
}

const langKeyboard = () => new InlineKeyboard().text("🇺🇿 O'zbekcha", "lang:uz").text("🇷🇺 Русский", "lang:ru");

function startKeyboard(lang: Lang) {
  const url = process.env.WEB_APP_URL;
  const kb = new InlineKeyboard();
  if (url) kb.webApp(tx(lang, "open"), url).row();
  kb.text("🇺🇿 O'zbekcha", "lang:uz").text("🇷🇺 Русский", "lang:ru");
  return kb;
}

function openKeyboard(lang: Lang) {
  const url = process.env.WEB_APP_URL;
  return url ? new InlineKeyboard().webApp(tx(lang, "open"), url) : undefined;
}

/** Chat pastidagi (yozish maydoni yonidagi) "Open app" menyu tugmasi. chatId bo'lsa — shu foydalanuvchi tilida. */
async function setMenuButton(lang: Lang, chatId?: number) {
  const url = process.env.WEB_APP_URL;
  if (!url) return;
  try {
    await bot.api.setChatMenuButton({
      ...(chatId ? { chat_id: chatId } : {}),
      menu_button: { type: "web_app", text: tx(lang, "menuButton"), web_app: { url } },
    });
  } catch (e) { console.error("setChatMenuButton xatosi:", e); }
}

async function setProfile() {
  try {
    for (const lang of ["uz", "ru"] as const) {
      const opts = lang === "ru" ? ({ language_code: "ru" } as const) : undefined;
      await bot.api.setMyDescription(tx(lang, "description"), opts);
      await bot.api.setMyShortDescription(tx(lang, "shortDesc"), opts);
    }
    await setMenuButton("uz");
  } catch (e) { console.error("Bot tavsifini o'rnatishda xato:", e); }
}

async function setCommands() {
  try {
    for (const lang of ["uz", "ru"] as const) {
      const commands = [
        { command: "start", description: tx(lang, "cmdStart") },
        { command: "today", description: tx(lang, "cmdToday") },
        { command: "month", description: tx(lang, "cmdMonth") },
        { command: "debts", description: tx(lang, "cmdDebts") },
        { command: "app", description: tx(lang, "cmdApp") },
        { command: "help", description: tx(lang, "cmdHelp") },
        { command: "about", description: tx(lang, "cmdAbout") },
        { command: "lang", description: tx(lang, "cmdLang") },
      ];
      // "ru" — rus tilidagi Telegram foydalanuvchilari uchun; standart (til ko'rsatilmagan) — o'zbekcha.
      if (lang === "ru") await bot.api.setMyCommands(commands, { language_code: "ru" });
      else await bot.api.setMyCommands(commands);
    }
  } catch (e) { console.error("setMyCommands xatosi:", e); }
}

bot.command("start", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) {
    const msg = await prisma.appSetting.findUnique({ where: { key: "maintenance_message" } });
    return ctx.reply(msg?.value ?? tx(lang, "maintenance"));
  }
  const user = await getUser(ctx);
  if (user?.blockedBot) {
    await prisma.user.update({ where: { id: user.id }, data: { blockedBot: false } });
  }
  await ctx.reply(tx(lang, "welcome"), { reply_markup: startKeyboard(lang) });
  if (ctx.chat) void setMenuButton(lang, ctx.chat.id);
});

bot.command("help", async ctx => {
  const lang = await langOf(ctx);
  await ctx.reply(tx(lang, "help"), { reply_markup: openKeyboard(lang) });
});

bot.command("about", async ctx => {
  const lang = await langOf(ctx);
  await ctx.reply(tx(lang, "about"), { reply_markup: openKeyboard(lang) });
});

bot.command("app", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const kb = openKeyboard(lang);
  if (!kb) return ctx.reply(tx(lang, "noAppUrl"));
  return ctx.reply(tx(lang, "welcome"), { reply_markup: kb });
});

bot.command("lang", async ctx => {
  await ctx.reply(tx("uz", "chooseLang"), { reply_markup: langKeyboard() });
});

bot.callbackQuery(/^lang:(uz|ru)$/, async ctx => {
  const lang = toLang(ctx.match[1]);
  const id = ctx.from?.id;
  if (id) {
    // Hisob hali bo'lmasa ham tanlov saqlanadi (Mini App ochilganda mavjud yozuv ishlatiladi).
    await prisma.user.upsert({
      where: { telegramId: String(id) },
      update: { language: lang },
      create: { telegramId: String(id), firstName: ctx.from?.first_name, lastName: ctx.from?.last_name, username: ctx.from?.username, language: lang },
    });
  }
  await ctx.answerCallbackQuery({ text: tx(lang, "langSet") });
  if (id) void setMenuButton(lang, id);
  try { await ctx.editMessageText(tx(lang, "welcome"), { reply_markup: startKeyboard(lang) }); }
  catch { await ctx.reply(tx(lang, "langSet")); }
});

bot.command("admin", async ctx => {
  const lang = await langOf(ctx);
  const user = await getUser(ctx);
  if (!user || user.role !== "ADMIN") return ctx.reply(tx(lang, "noAccess"));
  const url = process.env.WEB_APP_URL;
  if (!url) return ctx.reply(tx(lang, "noWebApp"));
  await ctx.reply(tx(lang, "adminGo"), {
    reply_markup: new InlineKeyboard().webApp(tx(lang, "adminOpen"), url),
  });
});

const sumBy = (rows: { type: string; amount: unknown }[], type: "INCOME" | "EXPENSE") =>
  rows.filter(t => t.type === type).reduce((s, t) => s + Number(t.amount), 0);

function report(lang: Lang, title: string, income: number, expense: number) {
  return `${title}\n\n${tx(lang, "income")}: ${formatMoney(income, lang)}\n${tx(lang, "expense")}: ${formatMoney(expense, lang)}\n${tx(lang, "diff")}: ${formatMoney(income - expense, lang)}`;
}

bot.command("today", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const user = await getUser(ctx);
  if (!user) return ctx.reply(tx(lang, "noUser"));
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const rows = await prisma.transaction.findMany({ where: { userId: user.id, occurredAt: { gte: start, lt: end } } });
  return ctx.reply(report(lang, tx(lang, "today"), sumBy(rows, "INCOME"), sumBy(rows, "EXPENSE")));
});

bot.command("month", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const user = await getUser(ctx);
  if (!user) return ctx.reply(tx(lang, "noUser"));
  const now = new Date(), bounds = monthBounds(now.getFullYear(), now.getMonth());
  const rows = await prisma.transaction.findMany({ where: { userId: user.id, occurredAt: { gte: bounds.start, lt: bounds.end } } });
  const label = now.toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });
  return ctx.reply(report(lang, `📊 ${label}`, sumBy(rows, "INCOME"), sumBy(rows, "EXPENSE")));
});

bot.command("debts", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const user = await getUser(ctx);
  if (!user) return ctx.reply(tx(lang, "noUser"));
  const rows = await prisma.debt.findMany({ where: { userId: user.id, status: { not: "PAID" } }, include: { payments: true } });
  if (!rows.length) return ctx.reply(tx(lang, "noDebts"));
  const lines = rows.map(d => {
    const paid = d.payments.reduce((s, p) => s + Number(p.amount), 0);
    return `${d.direction === "LENT" ? tx(lang, "lent") : tx(lang, "borrowed")} · ${d.personName}: ${formatMoney(Number(d.originalAmount) - paid, lang)}`;
  });
  return ctx.reply(tx(lang, "debtsTitle") + "\n\n" + lines.join("\n"));
});

// Buyruq bo'lmagan oddiy xabarlarga yo'l-yo'riq (buyruqlardan keyin ro'yxatdan o'tadi).
bot.on("message:text", async ctx => {
  const lang = await langOf(ctx);
  await ctx.reply(tx(lang, "unknown"), { reply_markup: openKeyboard(lang) });
});

bot.catch(async err => {
  console.error("Bot error:", err.error);
  const chatId = err.ctx?.from?.id;
  if (chatId && err.error instanceof Error && /blocked|forbidden/i.test(err.error.message)) {
    try {
      await prisma.user.updateMany({
        where: { telegramId: String(chatId) },
        data: { blockedBot: true },
      });
    } catch {}
  }
});

bot.start({ onStart: () => { console.log("Hisobchi bot ishga tushdi."); void setCommands(); void setProfile(); } });
process.once("SIGINT", () => { bot.stop(); void prisma.$disconnect(); });
process.once("SIGTERM", () => { bot.stop(); void prisma.$disconnect(); });
