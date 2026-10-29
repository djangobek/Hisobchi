import { Bot, InlineKeyboard } from "grammy";
import { randomUUID } from "node:crypto";
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
  open: { uz: "📱 Hisobimni ochish", ru: "📱 Открыть приложение" },
  welcome: {
    uz: "Assalomu alaykum! 👋\n\n<b>Hisobchi</b> — shaxsiy moliyangizni tartibga solishga yordam beradi.\n\n💸 Daromad va xarajatlarni qayd eting\n💳 Qarzlaringizni kuzatib boring\n📊 Hisobotlar orqali moliyaviy holatingizni ko‘ring\n🎙 Ovoz orqali tezkor qayd kiriting\n\nBoshlash uchun quyidagi tugmani bosing.",
    ru: "Здравствуйте! 👋\n\n<b>Хисобчи</b> поможет навести порядок в личных финансах.\n\n💸 Записывайте доходы и расходы\n💳 Контролируйте долги\n📊 Следите за финансами в отчётах\n🎙 Добавляйте записи голосом\n\nЧтобы начать, нажмите кнопку ниже.",
  },
  noAccess: { uz: "⛔ Bu bo‘limdan foydalanish uchun ruxsatingiz yo‘q.", ru: "⛔ У вас нет доступа к этому разделу." },
  noWebApp: { uz: "WEB_APP_URL sozlanmagan.", ru: "WEB_APP_URL не настроен." },
  adminGo: { uz: "🛡 Admin panelga o'tish:", ru: "🛡 Переход в админ-панель:" },
  adminOpen: { uz: "Admin panelni ochish", ru: "Открыть админ-панель" },
  noUser: { uz: "Avval «Hisobimni ochish» tugmasi orqali ilovaga kiring va hisobingizni yarating.", ru: "Сначала откройте приложение кнопкой «Открыть мой счёт» и создайте свой счёт." },
  today: { uz: "📅 Bugungi natijalar", ru: "📅 Итоги за сегодня" },
  income: { uz: "🟢 Daromad", ru: "🟢 Доходы" },
  expense: { uz: "🔴 Xarajat", ru: "🔴 Расходы" },
  diff: { uz: "📈 Sof natija", ru: "📈 Баланс" },
  noDebts: { uz: "✅ Hozircha ochiq qarzlaringiz yo‘q.\n\nYangi qarz qo‘shish uchun ilovani oching.", ru: "✅ У вас пока нет открытых долгов.\n\nЧтобы добавить долг, откройте приложение." },
  debtsTitle: { uz: "💳 Ochiq qarzlar", ru: "💳 Открытые долги" },
  lent: { uz: "↗️ Siz bergan", ru: "↗️ Вы дали" },
  borrowed: { uz: "↙️ Siz olgan", ru: "↙️ Вы взяли" },
  chooseLang: { uz: "🌐 <b>Interfeys tilini tanlang</b>\n\nQaysi tilda foydalanmoqchisiz?", ru: "🌐 <b>Выберите язык интерфейса</b>\n\nНа каком языке вам удобнее пользоваться приложением?" },
  langSet: { uz: "✅ Til o'zgartirildi: O'zbekcha", ru: "✅ Язык изменён: Русский" },
  cmdStart: { uz: "Botni ishga tushirish", ru: "Запустить бота" },
  cmdToday: { uz: "Bugungi hisobot", ru: "Отчёт за сегодня" },
  cmdMonth: { uz: "Joriy oy hisoboti", ru: "Отчёт за текущий месяц" },
  cmdDebts: { uz: "Ochiq qarzlar", ru: "Открытые долги" },
  cmdLang: { uz: "Tilni o'zgartirish", ru: "Сменить язык" },
  cmdHelp: { uz: "Yordam va imkoniyatlar", ru: "Помощь и возможности" },
  cmdAbout: { uz: "Bot haqida", ru: "О боте" },
  cmdApp: { uz: "Ilovani ochish", ru: "Открыть приложение" },
  menuButton: { uz: "📱 Hisobchi ilovasi", ru: "📱 Приложение Хисобчи" },
  shortDesc: {
    uz: "Daromad, xarajat va qarzlarni yuritish, AI moliyaviy maslahatchi.",
    ru: "Учёт доходов, расходов и долгов, ИИ-помощник по финансам.",
  },
  description: {
    uz: "💼 <b>Hisobchi</b> — shaxsiy moliyangiz uchun qulay yordamchi.\n\n• Daromad va xarajatlarni kategoriyalar bo‘yicha yuriting\n• Berilgan va olingan qarzlarni, qaytarilgan summalarni kuzating\n• Oylik hisobotlar, kalendar va diagrammalardan foydalaning\n• 🤖 Sun’iy intellekt yordamida xarajatlarni tahlil qiling\n• 🇺🇿 O‘zbekcha va 🇷🇺 ruscha interfeys\n\n📱 Ilovani oching va hisob-kitoblaringizni bir joyda boshqaring.",
    ru: "💼 <b>Хисобчи</b> — удобный помощник для личных финансов.\n\n• Учитывайте доходы и расходы по категориям\n• Контролируйте выданные и полученные долги, возвраты\n• Используйте месячные отчёты, календарь и диаграммы\n• 🤖 Анализируйте расходы с помощью искусственного интеллекта\n• 🇺🇿 Узбекский и 🇷🇺 русский интерфейс\n\n📱 Откройте приложение и управляйте финансами в одном месте.",
  },
  help: {
    uz: "ℹ️ <b>Yordam</b>\n\n📱 /app — ilovani ochish\n📅 /today — bugungi natijalar\n📊 /month — oylik hisobot\n💳 /debts — ochiq qarzlar\n🌐 /lang — tilni almashtirish\nℹ️ /about — Hisobchi haqida\n\nDaromad, xarajat, qarz va moliyaviy maqsadlarni boshqarish uchun ilovani oching. Ovozli xabar orqali ham daromad va xarajatlarni kiritishingiz mumkin.",
    ru: "ℹ️ <b>Помощь</b>\n\n📱 /app — открыть приложение\n📅 /today — итоги за сегодня\n📊 /month — отчёт за месяц\n💳 /debts — открытые долги\n🌐 /lang — сменить язык\nℹ️ /about — о Хисобчи\n\nОткройте приложение, чтобы управлять доходами, расходами, долгами и финансовыми целями. Доходы и расходы также можно добавлять голосом.",
  },
  about: {
    uz: "💼 <b>Hisobchi haqida</b>\n\nHisobchi — Telegram ichida ishlaydigan shaxsiy moliya yordamchisi.\n\n🟢 Daromad va 🔴 xarajatlar hisobi\n💳 Qarzlar, qisman to‘lovlar va muddatlar\n📊 Oylik hisobotlar, kalendar va diagrammalar\n🤖 Xarajat tahlili va tejash bo‘yicha tavsiyalar\n🔐 Moliyaviy yozuvlaringiz shaxsiy hisobingizda saqlanadi\n🌐 O‘zbekcha va ruscha interfeys\n\nTezkor buyruqlar: /today, /month, /debts.",
    ru: "💼 <b>О Хисобчи</b>\n\nХисобчи — помощник по личным финансам прямо в Telegram.\n\n🟢 Учёт доходов и 🔴 расходов\n💳 Долги, частичные платежи и сроки\n📊 Месячные отчёты, календарь и диаграммы\n🤖 Анализ расходов и рекомендации по накоплениям\n🔐 Финансовые записи хранятся в вашем личном аккаунте\n🌐 Узбекский и русский интерфейс\n\nБыстрые команды: /today, /month, /debts.",
  },
  unknown: {
    uz: "Bu xabarni tushunmadim 🙂\n\nMoliyaviy yozuvlar uchun ilovani oching yoki buyruqlar ro‘yxatini ko‘rish uchun /help ni bosing.",
    ru: "Не удалось распознать сообщение 🙂\n\nДля финансовых записей откройте приложение или нажмите /help, чтобы увидеть список команд.",
  },
  noAppUrl: { uz: "Ilova manzili (WEB_APP_URL) sozlanmagan.", ru: "Адрес приложения (WEB_APP_URL) не настроен." },
  voiceTooLong: { uz: "⏱ Ovozli xabar 15 soniyadan oshmasligi kerak. Iltimos, qisqaroq qilib qayta yuboring.", ru: "⏱ Голосовое сообщение должно быть не длиннее 15 секунд. Отправьте, пожалуйста, более короткое сообщение." },
  voiceNotConfigured: { uz: "🎙 Ovozli kiritish hozir sozlanmagan. Iltimos, keyinroq urinib ko‘ring yoki ma’lumotni matn orqali kiriting.", ru: "🎙 Голосовой ввод пока не настроен. Попробуйте позже или внесите запись текстом." },
  voiceLoading: { uz: "🎧 Ovozli xabar qabul qilindi. Audio yuklanmoqda…", ru: "🎧 Голосовое сообщение получено. Загружаем аудио…" },
  voiceTranscribing: { uz: "🗣 Nutq matnga aylantirilmoqda…", ru: "🗣 Преобразуем речь в текст…" },
  voiceAnalyzing: { uz: "🤖 Daromad va xarajatlar ajratilmoqda…", ru: "🤖 Определяем доходы и расходы…" },
  voiceNoOperations: { uz: "ℹ️ Ovozda moliyaviy operatsiya topilmadi. Masalan: «ovqatga 25 ming so‘m sarfladim» deb ayting.", ru: "ℹ️ Не удалось найти финансовые операции. Например: «потратил 25 тысяч сумов на еду»." },
  voiceUnclear: { uz: "❓ Summa yoki daromad/xarajat turi aniq emas. Iltimos, summani va nima uchun to‘langanini aniqroq ayting.", ru: "❓ Не удалось точно определить сумму или тип операции. Уточните сумму и назначение платежа." },
  voiceRetry: { uz: "⚠️ Ovozni qayta tahlil qilib bo‘lmadi. Qisqaroq va aniqroq qilib qayta yuboring yoki ma’lumotni matn orqali kiriting.", ru: "⚠️ Не удалось обработать аудио. Отправьте более короткое и чёткое сообщение или внесите запись текстом." },
  voiceExpired: { uz: "Tasdiqlash muddati tugagan. Iltimos, ovozli xabarni qayta yuboring.", ru: "Срок подтверждения истёк. Отправьте голосовое сообщение ещё раз." },
  voiceSaving: { uz: "Saqlash jarayoni davom etmoqda. Iltimos, kuting.", ru: "Записи уже сохраняются. Пожалуйста, подождите." },
  voiceCancelled: { uz: "❌ Operatsiyalar bekor qilindi. Hech qanday ma’lumot saqlanmadi.", ru: "❌ Операции отменены. Данные не сохранены." },
  voiceSaved: { uz: "ta operatsiya muvaffaqiyatli saqlandi.", ru: "операций успешно сохранено." },
  voiceSaveFailed: { uz: "Saqlash amalga oshmadi. Iltimos, qayta urinib ko‘ring.", ru: "Не удалось сохранить записи. Попробуйте ещё раз." },
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
      const opts = lang === "ru" ? { language_code: "ru" as const } : {};
      await bot.api.setMyDescription(tx(lang, "description").replace(/<[^>]*>/g, ""), opts);
      await bot.api.setMyShortDescription(tx(lang, "shortDesc").replace(/<[^>]*>/g, ""), opts);
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
  await ctx.reply(tx(lang, "welcome"), { parse_mode: "HTML", reply_markup: startKeyboard(lang) });
  if (ctx.chat) void setMenuButton(lang, ctx.chat.id);
});

bot.command("help", async ctx => {
  const lang = await langOf(ctx);
  await ctx.reply(tx(lang, "help"), { parse_mode: "HTML", reply_markup: openKeyboard(lang) });
});

bot.command("about", async ctx => {
  const lang = await langOf(ctx);
  await ctx.reply(tx(lang, "about"), { parse_mode: "HTML", reply_markup: openKeyboard(lang) });
});

bot.command("app", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const kb = openKeyboard(lang);
  if (!kb) return ctx.reply(tx(lang, "noAppUrl"));
  return ctx.reply(tx(lang, "welcome"), { parse_mode: "HTML", reply_markup: kb });
});

bot.command("lang", async ctx => {
  await ctx.reply(tx("uz", "chooseLang"), { parse_mode: "HTML", reply_markup: langKeyboard() });
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
  try { await ctx.editMessageText(tx(lang, "welcome"), { parse_mode: "HTML", reply_markup: startKeyboard(lang) }); }
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
  const net = income - expense;
  const summary = lang === "ru" ? "ФИНАНСОВЫЙ ИТОГ" : "MOLIYAVIY YAKUN";
  const netLabel = net >= 0
    ? (lang === "ru" ? "Остаток" : "Qolgan mablag‘")
    : (lang === "ru" ? "Превышение расходов" : "Xarajat daromaddan ko‘p");
  return `${title}\n━━━━━━━━━━━━━━━━━━\n<b>${summary}</b>\n\n${tx(lang, "income")}: <b>${formatMoney(income, lang)}</b>\n${tx(lang, "expense")}: <b>${formatMoney(expense, lang)}</b>\n\n${tx(lang, "diff")}: <b>${formatMoney(net, lang)}</b>\n<i>${netLabel}</i>`;
}

bot.command("today", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const user = await getUser(ctx);
  if (!user) return ctx.reply(tx(lang, "noUser"));
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const rows = await prisma.transaction.findMany({ where: { userId: user.id, occurredAt: { gte: start, lt: end } } });
  return ctx.reply(report(lang, tx(lang, "today"), sumBy(rows, "INCOME"), sumBy(rows, "EXPENSE")), { parse_mode: "HTML" });
});

bot.command("month", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const user = await getUser(ctx);
  if (!user) return ctx.reply(tx(lang, "noUser"));
  const now = new Date(), bounds = monthBounds(now.getFullYear(), now.getMonth());
  const rows = await prisma.transaction.findMany({ where: { userId: user.id, occurredAt: { gte: bounds.start, lt: bounds.end } } });
  const label = now.toLocaleDateString(localeOf(lang), { month: "long", year: "numeric" });
  return ctx.reply(report(lang, `📊 ${label}`, sumBy(rows, "INCOME"), sumBy(rows, "EXPENSE")), { parse_mode: "HTML" });
});

bot.command("debts", async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const user = await getUser(ctx);
  if (!user) return ctx.reply(tx(lang, "noUser"));
  const rows = await prisma.debt.findMany({ where: { userId: user.id, status: { not: "PAID" } }, include: { payments: true } });
  if (!rows.length) return ctx.reply(tx(lang, "noDebts"));
  const lines = rows.map((d, i) => {
    const paid = d.payments.reduce((s, p) => s + Number(p.amount), 0);
    const remaining = Math.max(0, Number(d.originalAmount) - paid);
    return `${i + 1}. ${d.direction === "LENT" ? tx(lang, "lent") : tx(lang, "borrowed")}\n   👤 ${htmlEscape(d.personName)}\n   💰 <b>${formatMoney(remaining, lang)}</b>`;
  });
  const total = rows.reduce((sum, d) => sum + Math.max(0, Number(d.originalAmount) - d.payments.reduce((paid, payment) => paid + Number(payment.amount), 0)), 0);
  const footer = lang === "ru" ? `\n━━━━━━━━━━━━━━━━━━\n<b>Всего осталось:</b> ${formatMoney(total, lang)}` : `\n━━━━━━━━━━━━━━━━━━\n<b>Jami qoldiq:</b> ${formatMoney(total, lang)}`;
  return ctx.reply(`${tx(lang, "debtsTitle")}\n━━━━━━━━━━━━━━━━━━\n\n${lines.join("\n\n")}${footer}`, { parse_mode: "HTML" });
});

/** Ovozli operatsiyalar: Muxlisa STT -> ElevenLabs Scribe fallback -> Gemini -> Groq -> explicit confirmation -> atomic DB. */
type VoiceOperation = {
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  note: string;
  occurredAt: string;
  confidence: number;
};
type VoiceDraft = {
  token: string; telegramId: string; userId: string;
  operations: VoiceOperation[]; transcript: string; createdAt: number;
};
const pendingVoiceDrafts = new Map<string, VoiceDraft>();
const savingVoiceTokens = new Set<string>();
const htmlEscape = (value: string) => value.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const VOICE_MAX_SECONDS = 15;
const VOICE_DRAFT_TTL_MS = 10 * 60 * 1000;
const VOICE_MIN_CONFIDENCE = 0.55;

function getTextFromStt(value: any): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  for (const key of ["text", "transcription", "transcript", "result", "recognized_text", "output"]) {
    const candidate = value[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  for (const candidate of Object.values(value)) { const found = getTextFromStt(candidate); if (found) return found; }
  return null;
}
async function transcribeWithMuxlisa(audio: Buffer, filename: string, mimeType: string): Promise<string> {
  const apiKey = process.env.MUXLISA_API_KEY;
  if (!apiKey) throw new Error("Muxlisa API key sozlanmagan");
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
  const response = await fetch("https://service.muxlisa.uz/api/v2/stt", {
    method: "POST", headers: { "x-api-key": apiKey }, body: form, signal: AbortSignal.timeout(45_000),
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Muxlisa HTTP ${response.status}`);
  const text = getTextFromStt(data);
  if (!text) throw new Error("Muxlisa bo'sh yoki tanilmagan javob qaytardi");
  return text;
}
/** ElevenLabs Scribe is optional; used only when Muxlisa is unavailable. */
async function transcribeWithElevenLabs(audio: Buffer, filename: string, mimeType: string): Promise<string> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ElevenLabs sozlanmagan");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
  form.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1");
  form.append("language_code", "uz");
  const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST", headers: { "xi-api-key": key }, body: form, signal: AbortSignal.timeout(45_000),
  });
  const data: any = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`ElevenLabs STT HTTP ${response.status}`);
  const text = getTextFromStt(data);
  if (!text) throw new Error("ElevenLabs bo'sh transkripsiya qaytardi");
  return text;
}
async function transcribeVoice(audio: Buffer, filename: string, mimeType: string): Promise<string> {
  try { return await transcribeWithMuxlisa(audio, filename, mimeType); }
  catch (e) {
    console.warn("[VOICE] Muxlisa STT muvaffaqiyatsiz; ElevenLabs fallback ishga tushadi.");
    return transcribeWithElevenLabs(audio, filename, mimeType);
  }
}
async function callGeminiForVoice(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key sozlanmagan");
  // Gemini model nomi URL ichida encode qilinadi; API key faqat query paramda yuboriladi.
  const model = (process.env.GEMINI_MODEL || "gemini-2.5-flash").trim().replace(/^models\//, "");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: {
        type: "ARRAY", items: { type: "OBJECT", properties: {
          type: { type: "STRING", enum: ["INCOME", "EXPENSE"] }, amount: { type: "NUMBER" },
          category: { type: "STRING" }, note: { type: "STRING" }, date: { type: "STRING" }, confidence: { type: "NUMBER" },
        }, required: ["type", "amount", "category", "note", "date", "confidence"] }
      }}
    }), signal: AbortSignal.timeout(25_000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}: ${data?.error?.message || "API xatosi"}`);
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") throw new Error("Gemini javobi safety filtri bilan to'xtadi");
  const text = candidate?.content?.parts?.map((p: any) => p.text || "").join("").trim();
  if (!text) throw new Error(`Gemini bo'sh javob qaytardi (${candidate?.finishReason || "no candidate"})`);
  return text;
}
async function callGroqForVoice(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq API key sozlanmagan");
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, temperature: 0, max_completion_tokens: 1800, response_format: { type: "json_object" }, messages: [
      { role: "system", content: "Moliyaviy operatsiyalarni ajrating. Faqat JSON qaytaring: {\"operations\":[...]}. Barcha operatsiyalarni saqlang." },
      { role: "user", content: prompt },
    ] }), signal: AbortSignal.timeout(25_000),
  });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Groq HTTP ${response.status}: ${data?.error?.message || "API xatosi"}`);
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Groq bo'sh javob qaytardi");
  return text;
}
function parseVoiceJson(text: string): any[] {
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
async function extractVoiceTransactions(transcript: string): Promise<{ operations: VoiceOperation[]; uncertain: number }> {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
  const prompt = `Vazifa: matnda tilga olingan HAR BIR alohida moliyaviy operatsiyani ajrat. Hech birini tashlab ketma va turli summalarni birlashtirma. O'zbek/rus tili. Masalan "Avtobusga besh ming, ovqatga yetti ming sarfladim, ish haqimdan ikki yuz ming tushdi" => 3 operatsiya: 5000 EXPENSE transport, 7000 EXPENSE ovqat, 200000 INCOME ish haqi. O'zbek sonlari: besh ming=5000, yetti yuz ming=700000, bir yarim million=1500000, ikki yuz ming=200000. Har bir summa faqat o'ziga tegishli tavsif bilan bog'lansin. "sarfladim/to'ladim/oldim (xarid ma'nosida)"=EXPENSE; "ish haqi tushdi/topdim/maosh oldim/daromad oldim"=INCOME. Kontekst noaniq bo'lsa amount yoki type ni null qil, taxmin qilma. Faqat operatsiyalarni kirit, qarz/kelajak reja/oddiy tilga olishni operatsiya deb hisoblama. date YYYY-MM-DD, aytilmasa ${today}. confidence 0..1. Faqat JSON massiv qaytar: [{"type":"EXPENSE","amount":5000,"category":"Transport","note":"Avtobus","date":"${today}","confidence":0.95}]. Bugungi sana: ${today}. Nutq: ${JSON.stringify(transcript)}`;
  let raw: string;
  try { raw = await callGeminiForVoice(prompt); }
  catch (e) {
    console.warn("[VOICE] Gemini so‘rovi muvaffaqiyatsiz; Groq fallback ishga tushadi.");
    raw = await callGroqForVoice(prompt);
  }
  let rows: any[];
  try { rows = parseVoiceJson(raw); }
  catch (e) {
    console.warn("[VOICE] AI javobi JSON formatida emas; qayta urinish amalga oshiriladi.");
    if (!process.env.GROQ_API_KEY) throw e;
    rows = parseVoiceJson(await callGroqForVoice(prompt + "\nJAVOBINGIZNI QAT'IY JSON formatida qayta bering."));
  }
  if (rows.length > 20) throw new Error("Bir ovozdan 20 tadan ortiq operatsiya aniqlandi; iltimos, qismlarga bo'ling.");
  const operations: VoiceOperation[] = []; let uncertain = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") { uncertain++; continue; }
    const amount = typeof row.amount === "number" ? row.amount : Number.NaN;
    const type = row.type;
    const confidence = typeof row.confidence === "number" ? row.confidence : 0;
    if ((type !== "INCOME" && type !== "EXPENSE") || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000 || confidence < VOICE_MIN_CONFIDENCE) { uncertain++; continue; }
    const category = typeof row.category === "string" ? row.category.trim().slice(0, 60) : "";
    const note = typeof row.note === "string" ? row.note.trim().slice(0, 240) : "";
    operations.push({ amount: Math.round(amount * 100) / 100, type, category: category || (type === "INCOME" ? "Boshqa tushum" : "Boshqa xarajat"), note: note || transcript.slice(0, 240), occurredAt: validIsoDate(row.date, today), confidence });
  }
  return { operations, uncertain };
}
function voiceConfirmKeyboard(token: string, lang: Lang) {
  const confirm = lang === "ru" ? "✅ Подтвердить всё" : "✅ Barchasini saqlash";
  const cancel = lang === "ru" ? "❌ Отменить" : "❌ Bekor qilish";
  return new InlineKeyboard().text(confirm, `voice:ok:${token}`).row().text(cancel, `voice:cancel:${token}`);
}
function formatVoiceDraft(draft: VoiceDraft, lang: Lang): string {
  const income = draft.operations.filter(x => x.type === "INCOME").reduce((a, x) => a + x.amount, 0);
  const expense = draft.operations.filter(x => x.type === "EXPENSE").reduce((a, x) => a + x.amount, 0);
  const title = lang === "ru" ? "🎙 <b>Проверьте распознанные записи</b>" : "🎙 <b>Ovozdan aniqlangan yozuvlarni tekshiring</b>";
  const transcriptLabel = lang === "ru" ? "📝 Распознанный текст" : "📝 Aniqlangan matn";
  const incomeLabel = lang === "ru" ? "🟢 Итого доходы" : "🟢 Jami daromad";
  const expenseLabel = lang === "ru" ? "🔴 Итого расходы" : "🔴 Jami xarajat";
  const categoryLabel = lang === "ru" ? "Категория" : "Kategoriya";
  const noteLabel = lang === "ru" ? "Комментарий" : "Izoh";
  const dateLabel = lang === "ru" ? "Дата" : "Sana";
  const incomeType = lang === "ru" ? "Доход" : "Daromad";
  const expenseType = lang === "ru" ? "Расход" : "Xarajat";
  const safeRows = draft.operations.map((op, i) => {
    const date = new Date(`${op.occurredAt}T12:00:00+05:00`).toLocaleDateString(localeOf(lang), { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tashkent" });
    return `${i + 1}. ${op.type === "INCOME" ? `🟢 ${incomeType}` : `🔴 ${expenseType}`}: <b>${formatMoney(op.amount, lang)}</b>\n   ${categoryLabel}: ${htmlEscape(op.category)}\n   ${noteLabel}: ${htmlEscape(op.note)}\n   ${dateLabel}: ${date}`;
  });
  const confirmation = lang === "ru" ? "👇 Проверьте суммы, категории и даты. Записи сохранятся только после вашего подтверждения." : "👇 Summa, kategoriya va sanalarni tekshiring. Yozuvlar faqat siz tasdiqlaganingizdan keyin saqlanadi.";
  return `${title}\n\n${transcriptLabel}: <i>${htmlEscape(draft.transcript)}</i>\n\n${safeRows.join("\n\n")}\n\n${incomeLabel}: <b>${formatMoney(income, lang)}</b>\n${expenseLabel}: <b>${formatMoney(expense, lang)}</b>\n\n${confirmation}`;
}
bot.on(["message:voice", "message:audio"], async ctx => {
  const lang = await langOf(ctx);
  if (await isMaintenance()) return ctx.reply(tx(lang, "maintenance"));
  const user = await getUser(ctx);
  if (!user) return ctx.reply(tx(lang, "noUser"));
  const media = ctx.message.voice ?? ctx.message.audio;
  if (!media) return;
  if (media.duration > VOICE_MAX_SECONDS) return ctx.reply(tx(lang, "voiceTooLong"));
  if (!process.env.MUXLISA_API_KEY && !process.env.ELEVENLABS_API_KEY) return ctx.reply(tx(lang, "voiceNotConfigured"));
  const status = await ctx.reply(tx(lang, "voiceLoading"));
  const progress = async (text: string) => ctx.api.editMessageText(ctx.chat.id, status.message_id, text, { parse_mode: "HTML" }).catch(() => {});
  try {
    await progress(lang === "ru" ? "🎧 <b>Шаг 1 из 3.</b> Загружаем аудио…" : "🎧 <b>1/3-bosqich.</b> Ovoz yuklanmoqda…");
    const file = await ctx.api.getFile(media.file_id);
    if (!file.file_path) throw new Error("Telegram audio fayl manzili yo'q");
    const download = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(20_000) });
    if (!download.ok) throw new Error(`Telegram audio HTTP ${download.status}`);
    const audio = Buffer.from(await download.arrayBuffer());
    if (audio.length > 10 * 1024 * 1024) throw new Error("Audio fayl hajmi limitdan katta");
    await progress((lang === "ru" ? "<b>Шаг 2 из 3.</b> " : "<b>2/3-bosqich.</b> ") + tx(lang, "voiceTranscribing"));
    const transcript = await transcribeVoice(audio, file.file_path.split("/").pop() || "voice.ogg", media.mime_type || "audio/ogg");
    console.log(`[VOICE] STT tayyor; belgilar=${transcript.length}`);
    await progress((lang === "ru" ? "<b>Шаг 3 из 3.</b> " : "<b>3/3-bosqich.</b> ") + tx(lang, "voiceAnalyzing"));
    const { operations, uncertain } = await extractVoiceTransactions(transcript);
    if (!operations.length) throw new Error(uncertain ? "Noaniq summa yoki tur topildi" : "Moliyaviy operatsiya topilmadi");
    const tokenId = randomUUID().replace(/-/g, "").slice(0, 20);
    const draft: VoiceDraft = { token: tokenId, telegramId: String(ctx.from.id), userId: user.id, operations, transcript, createdAt: Date.now() };
    pendingVoiceDrafts.set(tokenId, draft);
    for (const [key, value] of pendingVoiceDrafts) if (Date.now() - value.createdAt > VOICE_DRAFT_TTL_MS) pendingVoiceDrafts.delete(key);
    const extra = uncertain ? `\n\n⚠️ ${uncertain} ta noaniq operatsiya saqlanmadi. Ularni matn orqali aniqlashtiring.` : "";
    await ctx.api.editMessageText(ctx.chat.id, status.message_id, formatVoiceDraft(draft, lang) + extra, { parse_mode: "HTML", reply_markup: voiceConfirmKeyboard(tokenId, lang) });
  } catch (error) {
    console.error("[VOICE] Ovoz tahlili muvaffaqiyatsiz.");
    const msg = error instanceof Error && /Moliyaviy operatsiya topilmadi/.test(error.message)
      ? tx(lang, "voiceNoOperations")
      : error instanceof Error && /Noaniq summa/.test(error.message)
      ? tx(lang, "voiceUnclear")
      : tx(lang, "voiceRetry");
    await ctx.api.editMessageText(ctx.chat.id, status.message_id, msg).catch(() => {});
  }
});
bot.callbackQuery(/^voice:(ok|cancel):([a-f0-9]+)$/, async ctx => {
  const [, action, tokenId] = ctx.match;
  const draft = pendingVoiceDrafts.get(tokenId);
  if (!draft || draft.telegramId !== String(ctx.from.id) || Date.now() - draft.createdAt > VOICE_DRAFT_TTL_MS) {
    pendingVoiceDrafts.delete(tokenId);
    const lang = await langOf(ctx);
    return ctx.answerCallbackQuery({ text: tx(lang, "voiceExpired"), show_alert: true });
  }
  if (action === "cancel") {
    pendingVoiceDrafts.delete(tokenId);
    const lang = await langOf(ctx);
    await ctx.answerCallbackQuery({ text: lang === "ru" ? "Отменено" : "Bekor qilindi" });
    return ctx.editMessageText(tx(lang, "voiceCancelled"));
  }
  // In-memory lock prevents concurrent callback double clicks; DB unique requestKey is the durable guard.
  if (savingVoiceTokens.has(tokenId)) {
    const lang = await langOf(ctx);
    return ctx.answerCallbackQuery({ text: tx(lang, "voiceSaving") });
  }
  savingVoiceTokens.add(tokenId);
  try {
    const lang = await langOf(ctx);
    await prisma.$transaction(async tx => {
      for (let i = 0; i < draft.operations.length; i++) {
        const op = draft.operations[i];
        const categoryName = op.category || (op.type === "INCOME" ? "Boshqa tushum" : "Boshqa xarajat");
        const category = await tx.category.upsert({
          where: { userId_name_type: { userId: draft.userId, name: categoryName, type: op.type } },
          update: {}, create: { userId: draft.userId, name: categoryName, type: op.type, isDefault: false },
        });
        await tx.transaction.create({ data: {
          userId: draft.userId, amount: op.amount, type: op.type, categoryId: category.id, note: op.note,
          occurredAt: new Date(`${op.occurredAt}T00:00:00+05:00`), requestKey: `voice:${tokenId}:${i}`,
        } });
      }
    });
    pendingVoiceDrafts.delete(tokenId);
    const savedText = `✅ <b>${draft.operations.length} ${tx(lang, "voiceSaved")}</b>`;
    // DB commit is complete; Telegram UI errors must not be reported as a failed save.
    await ctx.answerCallbackQuery({ text: savedText.replace(/<[^>]*>/g, "") }).catch(() => {});
    await ctx.editMessageText(`${savedText}\n\n${formatVoiceDraft(draft, lang).split("\n\n").slice(1).join("\n\n")}`, { parse_mode: "HTML" }).catch(() => {});
  } catch (error) {
    console.error("[VOICE] Ma’lumotlarni saqlash muvaffaqiyatsiz.");
    const lang = await langOf(ctx);
    await ctx.answerCallbackQuery({ text: tx(lang, "voiceSaveFailed"), show_alert: true }).catch(() => {});
  } finally {
    savingVoiceTokens.delete(tokenId);
  }
});
// Legacy text handler remains for the bot's normal commands and the existing edit flow.
bot.on("message:text", async ctx => {
  const lang = await langOf(ctx);
  await ctx.reply(tx(lang, "unknown"), { reply_markup: openKeyboard(lang) });
});

bot.catch(async err => {
  console.error("Botda kutilmagan xatolik yuz berdi.");
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
