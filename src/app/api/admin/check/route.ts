import { NextRequest, NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/telegram";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { isEnvAdmin } from "@/lib/admin-ids";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ initData: z.string().min(1) }).parse(await req.json());
    const tg = validateTelegramInitData(
      body.initData,
      process.env.BOT_TOKEN ?? "",
      Number(process.env.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS ?? 86400)
    );
    const user = await prisma.user.upsert({
      where: { telegramId: String(tg.id) },
      update: {
        firstName: tg.first_name,
        lastName: tg.last_name,
        username: tg.username,
        lastActiveAt: new Date(),
        ...(isEnvAdmin(tg.id) ? { role: UserRole.ADMIN } : {}),
      },
      create: {
        role: isEnvAdmin(tg.id) ? UserRole.ADMIN : UserRole.USER,
        telegramId: String(tg.id),
        firstName: tg.first_name,
        lastName: tg.last_name,
        username: tg.username,
      },
    });
    const maintenance = await prisma.appSetting.findUnique({ where: { key: "maintenance_mode" } });
    const maintenanceMsg = await prisma.appSetting.findUnique({ where: { key: "maintenance_message" } });
    return NextResponse.json({
      id: user.id,
      role: user.role,
      isAdmin: user.role === UserRole.ADMIN,
      isBlocked: user.isBlocked,
      maintenance: maintenance?.value === "true",
      maintenanceMessage: maintenanceMsg?.value ?? "",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Autentifikatsiya bajarilmadi." },
      { status: 401 }
    );
  }
} 