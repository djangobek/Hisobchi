import { prisma } from "./prisma";
import { NextRequest } from "next/server";
import { validateTelegramInitData } from "./telegram";
import { UserRole } from "@prisma/client";
import { isEnvAdmin } from "./admin-ids";

export type AuthUser = {
  id: string;
  telegramId: string;
  firstName: string | null;
  role: UserRole;
  isBlocked: boolean;
  language: "uz" | "ru";
};

export async function getAuthUser(req: NextRequest): Promise<AuthUser> {
  const raw = req.headers.get("x-telegram-init-data");
  if (!raw) throw new Error("Telegram sessiyasi topilmadi.");
  const tg = validateTelegramInitData(
    raw,
    process.env.BOT_TOKEN ?? "",
    Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? 86400)
  );
  const user = await prisma.user.findUnique({
    where: { telegramId: String(tg.id) },
    select: { id: true, telegramId: true, firstName: true, role: true, isBlocked: true, lastActiveAt: true, language: true },
  });
  if (!user) throw new Error("Foydalanuvchi topilmadi.");
  // .env dagi admin har doim ADMIN bo'lib qoladi (terminalda qo'lda berish shart emas).
  if (user.role !== UserRole.ADMIN && isEnvAdmin(user.telegramId)) {
    await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.ADMIN } });
    user.role = UserRole.ADMIN;
  }
  if (user.isBlocked) throw new Error("Hisobingiz bloklangan.");
  // Har so'rovda yozmaymiz: faqat 5 daqiqadan eski bo'lsa (DB yozuvlari ~100x kamayadi).
  if (Date.now() - user.lastActiveAt.getTime() > 5 * 60_000) {
    void prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => {});
  }
  const { lastActiveAt: _l, language, ...rest } = user;
  return { ...rest, language: language === "ru" ? "ru" : "uz" };
}

export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (user.role !== UserRole.ADMIN) {
    throw new Error("Ruxsat yo'q. Faqat adminlar uchun.");
  }
  return user;
}

export async function logAdminAction(
  adminId: string,
  action: string,
  target?: string,
  metadata?: Record<string, unknown>
) {
  await prisma.adminAction.create({
    data: { adminId, action, target, metadata: metadata ? JSON.stringify(metadata) : null },
  });
}