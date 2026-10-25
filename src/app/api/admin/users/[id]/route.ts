import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await ctx.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { transactions: true, debts: true, categories: true } },
        transactions: {
          orderBy: { occurredAt: "desc" },
          take: 100,
          include: { category: { select: { name: true, color: true } } },
        },
        debts: { orderBy: { occurredAt: "desc" }, take: 50, include: { payments: true } },
      },
    });
    if (!user) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });

    // Avval faqat oxirgi 100 ta tranzaksiya yig'ilardi (noto'g'ri). Endi DB'da to'liq hisob.
    const agg = await prisma.transaction.groupBy({ by: ["type"], where: { userId: id }, _sum: { amount: true } });
    const income = Number(agg.find(a => a.type === "INCOME")?._sum.amount ?? 0);
    const expense = Number(agg.find(a => a.type === "EXPENSE")?._sum.amount ?? 0);

    return NextResponse.json({
      user: {
        id: user.id,
        telegramId: user.telegramId,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        role: user.role,
        isBlocked: user.isBlocked,
        blockedBot: user.blockedBot,
        lastActiveAt: user.lastActiveAt,
        createdAt: user.createdAt,
        counts: user._count,
      },
      finance: { income, expense, balance: income - expense },
      transactions: user.transactions,
      debts: user.debts,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Xatolik." }, { status: 403 });
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(req);
    const { id } = await ctx.params;
    const body = await req.json();

    const data: any = {};
    if (typeof body.isBlocked === "boolean") data.isBlocked = body.isBlocked;
    if (typeof body.role === "string" && ["USER", "ADMIN"].includes(body.role)) data.role = body.role;

    const updated = await prisma.user.update({ where: { id }, data });
    return NextResponse.json({ ok: true, user: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Xatolik." }, { status: 403 });
  }
}