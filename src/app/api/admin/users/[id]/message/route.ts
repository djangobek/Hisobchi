import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, logAdminAction } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

const schema = z.object({
  message: z.string().min(1).max(4000),
  buttonText: z.string().max(64).optional(),
  buttonUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const data = schema.parse(await req.json());

    const token = process.env.BOT_TOKEN;
    if (!token) throw new Error("BOT_TOKEN sozlanmagan.");

    const user = await (await import("@/lib/prisma")).prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error("Foydalanuvchi topilmadi.");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: user.telegramId,
        text: data.message,
        parse_mode: "HTML",
        reply_markup: data.buttonUrl
          ? { inline_keyboard: [[{ text: data.buttonText ?? "Ochish", url: data.buttonUrl }]] }
          : undefined,
      }),
    });

    const result = await res.json();
    if (!result.ok) {
      if (result.description?.includes("blocked")) {
        await (await import("@/lib/prisma")).prisma.user.update({
          where: { id },
          data: { blockedBot: true },
        });
      }
      throw new Error(result.description ?? "Yuborishda xatolik.");
    }

    await logAdminAction(admin.id, "send_message", id, { preview: data.message.slice(0, 50) });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Xatolik." }, { status: 400 });
  }
}