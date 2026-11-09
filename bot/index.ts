/**
 * Hisobchi Telegram boti — kirish nuqtasi.
 *
 * Tuzilma:
 *   config.ts    — sozlamalar (.env)
 *   texts.ts     — uz/ru matnlar
 *   util.ts      — sana (Toshkent), ism solishtirish, kichik yordamchilar
 *   ai/          — provayderlar: muxlisa, elevenlabs, groq + umumiy http/json/xato modullari
 *   dedup.ts     — takroriy Telegram update'lardan himoya
 *   stt.ts       — nutq → matn: Muxlisa (asosiy) → ElevenLabs (faqat zaxira)
 *   nlu.ts       — matn → operatsiyalar: Groq (yagona AI) → lokal parser (zaxira)
 *   store.ts     — Prisma: kontekst, qarzlarni moslash, saqlash, statistika
 *   voice.ts     — ovoz/matn kiritish, tasdiqlash oqimi
 *   commands.ts  — buyruqlar va hisobotlar
 *   scheduler.ts — eslatmalar
 */
import { Bot } from "grammy";
import { randomUUID } from "node:crypto";
import { registerCommands, setupProfile } from "./commands";
import { prisma } from "./store";
import { startScheduler } from "./scheduler";
import { registerVoice } from "./voice";
import { updateDedup } from "./dedup";
import { registerWidgetHandlers } from "./widgets";

const token = process.env.BOT_TOKEN;
if (!token) { console.error("BOT_TOKEN .env faylida ko'rsatilmagan."); process.exit(1); }

const apiRoot = process.env.TELEGRAM_BOT_API_BASE_URL || (process.env.WIDGETS_ENABLED === "true" ? "https://api.telegram.org/beta" : "https://api.telegram.org");
const bot = new Bot(token, { client: { apiRoot } });

bot.use(updateDedup); // takroriy update_id larni e'tiborsiz qoldiradi
registerWidgetHandlers(bot); // Bot API 10.4 widget queries va widget buyruqlari
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
let leaseTimer: NodeJS.Timeout | null = null;
const instanceId = randomUUID();
const leaseKey = "bot:polling:lease";
let shuttingDown = false;

/**
 * Bitta BOT_TOKEN uchun faqat bitta long-polling worker ishlashini kafolatlaydi.
 * Render/hosting bir nechta instance ko'targanda ikki bot bir xil update'ga javob
 * yuborishining oldini olish uchun PostgreSQL'da 60 soniyalik lease ishlatiladi.
 */
async function acquirePollingLease(): Promise<boolean> {
  const claimed = await prisma.$executeRaw`
    INSERT INTO "AppSetting" ("key", "value", "updatedAt")
    VALUES (${leaseKey}, ${instanceId}, NOW())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = EXCLUDED."value", "updatedAt" = NOW()
      WHERE "AppSetting"."updatedAt" < NOW() - INTERVAL '60 seconds'
  `;
  return claimed === 1;
}

async function releasePollingLease() {
  await prisma.appSetting.deleteMany({ where: { key: leaseKey, value: instanceId } }).catch(() => {});
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  if (leaseTimer) clearInterval(leaseTimer);
  stopScheduler?.();
  await bot.stop();
  await releasePollingLease();
  await prisma.$disconnect();
}

async function main() {
  if (!(await acquirePollingLease())) {
    console.error("Boshqa Hisobchi bot instance'i polling qilmoqda. Ikkinchi worker ishga tushirilmadi.");
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  // Webhook va long polling bir vaqtda ishlasa update'lar yo'qolishi yoki takroriy
  // javoblar yuzaga kelishi mumkin. Webhook'ni avtomatik o'chirmaymiz.
  const webhook = await bot.api.getWebhookInfo();
  if (webhook.url) {
    console.error("Telegram webhook faol. Long polling boshlanmadi; webhook yoki polling usulidan bittasini tanlang.");
    await releasePollingLease();
    await prisma.$disconnect();
    process.exitCode = 1;
    return;
  }

  leaseTimer = setInterval(async () => {
    try {
      const renewed = await prisma.appSetting.updateMany({
        where: { key: leaseKey, value: instanceId }, data: { updatedAt: new Date() },
      });
      if (renewed.count !== 1) {
        console.error("Bot polling lease yo'qotildi. Ikkinchi worker bilan to'qnashuvning oldini olish uchun bot to'xtatilmoqda.");
        await shutdown();
        process.exitCode = 1;
      }
    } catch (error) {
      console.error("Bot polling lease yangilanmadi:", error instanceof Error ? error.message : error);
    }
  }, 15_000);
  leaseTimer.unref();

  void bot.start({
    onStart: () => {
      console.log("Hisobchi bot ishga tushdi (yagona polling worker).");
      console.log(`[STT] Muxlisa (asosiy): ${process.env.MUXLISA_API_KEY ? "✓" : "—"} · ElevenLabs (zaxira): ${process.env.ELEVENLABS_API_KEY ? "✓" : "—"}`);
      console.log(`[NLU] Groq (asosiy): ${process.env.GROQ_API_KEY ? "✓" : "—"} · lokal parser (zaxira): ✓`);
      void setupProfile(bot);
      stopScheduler = startScheduler(bot);
    },
  });
}

process.once("SIGINT", () => { void shutdown(); });
process.once("SIGTERM", () => { void shutdown(); });
void main().catch(async error => {
  console.error("Botni ishga tushirishda xato:", error instanceof Error ? error.message : error);
  await releasePollingLease();
  await prisma.$disconnect();
  process.exitCode = 1;
});
