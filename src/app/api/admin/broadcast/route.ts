import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({
  message: z.string().min(1).max(4000),
  buttonText: z.string().max(64).optional(),
  buttonUrl: z.string().url().optional(),
  segment: z.enum(["all", "active", "inactive", "blocked"]).default("all"),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const data = schema.parse(await req.json());
    const token = process.env.BOT_TOKEN;
    if (!token) throw new Error("BOT_TOKEN sozlanmagan.");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let where: any = {};
    if (data.segment === "active") where.lastActiveAt = { gte: weekAgo };
    if (data.segment === "inactive") where.lastActiveAt = { lt: weekAgo };
    if (data.segment === "blocked") where.blockedBot = true;
    if (data.segment !== "blocked") where.blockedBot = false;

    const users = await prisma.user.findMany({ where, select: { id: true, telegramId: true } });

    const broadcast = await prisma.broadcast.create({
      data: {
        message: data.message,
        buttonText: data.buttonText,
        buttonUrl: data.buttonUrl,
        segment: data.segment,
        createdBy: admin.id,
      },
    });

    let sent = 0;
    let failed = 0;

    for (const u of users) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: u.telegramId,
            text: data.message,
            parse_mode: "HTML",
            reply_markup: data.buttonUrl
              ? { inline_keyboard: [[{ text: data.buttonText ?? "Ochish", url: data.buttonUrl }]] }
              : undefined,
          }),
        });
        const r = await res.json();
        if (r.ok) {
          sent++;
          await prisma.broadcastLog.create({
            data: { broadcastId: broadcast.id, userId: u.id, status: "SENT", sentAt: new Date() },
          });
        } else {
          failed++;
          if (r.description?.includes("blocked")) {
            await prisma.user.update({ where: { id: u.id }, data: { blockedBot: true } });
          }
          await prisma.broadcastLog.create({
            data: { broadcastId: broadcast.id, userId: u.id, status: "FAILED", error: r.description },
          });
        }
        await new Promise(r => setTimeout(r, 35));
      } catch (err) {
        failed++;
      }
    }

    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { totalSent: sent, totalFailed: failed },
    });

    await logAdminAction(admin.id, "broadcast", undefined, { sent, failed, segment: data.segment });
    return NextResponse.json({ ok: true, sent, failed, total: users.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Xatolik." }, { status: 400 });
  }
}