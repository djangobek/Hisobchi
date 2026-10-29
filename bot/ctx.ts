import type { Context } from "grammy";
import { InlineKeyboard } from "grammy";
import { langFromTelegram, toLang, type Lang } from "../src/lib/i18n";
import { prisma } from "./store";
import { CFG } from "./config";
import { tx } from "./texts";

export const getUser = async (ctx: Context) => {
  const id = ctx.from?.id;
  return id ? prisma.user.findUnique({ where: { telegramId: String(id) } }) : null;
};

/** Foydalanuvchining saqlangan tili; hisob bo'lmasa — Telegram tili. */
export async function langOf(ctx: Context): Promise<Lang> {
  const user = await getUser(ctx);
  return user ? toLang(user.language) : langFromTelegram(ctx.from?.language_code);
}

export async function isMaintenance() {
  const s = await prisma.appSetting.findUnique({ where: { key: "maintenance_mode" } });
  return s?.value === "true";
}

export function openKeyboard(lang: Lang) {
  const url = process.env.WEB_APP_URL;
  return url ? new InlineKeyboard().webApp(tx(lang, "open"), url) : undefined;
}

/** Foydalanuvchi bo'yicha sirpanuvchi oyna: AI/STT kvotasini suiiste'moldan himoya qiladi. */
const hits = new Map<string, number[]>();
export function rateLimited(userKey: string): boolean {
  const now = Date.now();
  const arr = (hits.get(userKey) ?? []).filter(t => now - t < 60_000);
  if (arr.length >= CFG.rateLimitPerMinute) { hits.set(userKey, arr); return true; }
  arr.push(now); hits.set(userKey, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < 60_000)) hits.delete(k);
  return false;
}

/** Foydalanuvchi + til + texnik ishlar tekshiruvi. Muvaffaqiyatsiz bo'lsa javob yuboradi va null qaytaradi. */
export async function requireUser(ctx: Context) {
  const lang = await langOf(ctx);
  if (await isMaintenance()) { await ctx.reply(tx(lang, "maintenance")); return null; }
  const user = await getUser(ctx);
  if (!user) { await ctx.reply(tx(lang, "noUser"), { reply_markup: openKeyboard(lang) }); return null; }
  if (user.isBlocked) { await ctx.reply(tx(lang, "noAccess")); return null; }
  return { user, lang };
}
