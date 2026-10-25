import { createHmac, timingSafeEqual } from "node:crypto";
export type TelegramUser = { id: number; first_name: string; last_name?: string; username?: string; language_code?: string };
export function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400): TelegramUser {
  if (!initData || !botToken) throw new Error("Telegram autentifikatsiyasi sozlanmagan.");
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  if (!hash || !Number.isFinite(authDate)) throw new Error("Telegram ma’lumotlari noto‘g‘ri.");
  if (Math.abs(Date.now()/1000 - authDate) > maxAgeSeconds) throw new Error("Kirish muddati tugagan. Ilovani qayta oching.");
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(hash, "hex"); } catch { throw new Error("Telegram imzosi noto‘g‘ri."); }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("Telegram imzosi tekshiruvdan o‘tmadi.");
  const rawUser = params.get("user");
  if (!rawUser) throw new Error("Telegram foydalanuvchisi topilmadi.");
  const user = JSON.parse(rawUser) as TelegramUser;
  if (!Number.isSafeInteger(user.id)) throw new Error("Telegram foydalanuvchi ID noto‘g‘ri.");
  return user;
}