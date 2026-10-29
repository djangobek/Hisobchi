/**
 * Hisobchi Telegram boti — kirish nuqtasi.
 *
 * Tuzilma:
 *   config.ts    — sozlamalar (.env)
 *   texts.ts     — uz/ru matnlar
 *   util.ts      — sana (Toshkent), ism solishtirish, kichik yordamchilar
 *   stt.ts       — nutq → matn: ElevenLabs (asosiy) → Muxlisa (zaxira)
 *   nlu.ts       — matn → operatsiyalar: Gemini → Groq → lokal parser
 *   store.ts     — Prisma: kontekst, qarzlarni moslash, saqlash, statistika
 *   voice.ts     — ovoz/matn kiritish, tasdiqlash oqimi
 *   commands.ts  — buyruqlar va hisobotlar
 *   scheduler.ts — eslatmalar
 */
import { Bot } from "grammy";
import { registerCommands, setupProfile } from "./commands";
import { prisma } from "./store";
import { startScheduler } from "./scheduler";
import { registerVoice } from "./voice";

const token = process.env.BOT_TOKEN;
if (!token) { console.error("BOT_TOKEN .env faylida ko'rsatilmagan."); process.exit(1); }

const bot = new Bot(token);

registerCommands(bot); // buyruqlar va callback'lar (til, /last, ...)
registerVoice(bot);    // ovoz, audio, oddiy matn — buyruqlardan KEYIN ro'yxatga olinishi shart

bot.catch(async err => {
  console.error("Botda kutilmagan xatolik:", err.error instanceof Error ? err.error.message : err.error);
  const tgId = err.ctx?.from?.id;
  if (tgId && err.error instanceof Error && /blocked|forbidden/i.test(err.error.message)) {
    await prisma.user.updateMany({ where: { telegramId: String(tgId) }, data: { blockedBot: true } }).catch(() => {});
  }
});

let stopScheduler: (() => void) | null = null;
bot.start({
  onStart: () => {
    console.log("Hisobchi bot ishga tushdi.");
    console.log(`[STT] ElevenLabs: ${process.env.ELEVENLABS_API_KEY ? "✓" : "—"} (asosiy) · Muxlisa: ${process.env.MUXLISA_API_KEY ? "✓" : "—"} (zaxira)`);
    console.log(`[NLU] Gemini: ${process.env.GEMINI_API_KEY ? "✓" : "—"} · Groq: ${process.env.GROQ_API_KEY ? "✓" : "—"} · lokal parser: ✓`);
    void setupProfile(bot);
    stopScheduler = startScheduler(bot);
  },
});

const shutdown = () => { stopScheduler?.(); void bot.stop(); void prisma.$disconnect(); };
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
