import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { etagJson, adminError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    rateLimit(`users:${admin.id}`, 40, 2);
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    const filter = req.nextUrl.searchParams.get("filter") ?? "all"; // all | active | inactive | blocked | admins
    const sort = req.nextUrl.searchParams.get("sort") ?? "recent"; // recent | new | volume
    const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1"));
    const limit = Math.min(50, Math.max(5, Number(req.nextUrl.searchParams.get("limit") ?? "20")));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { telegramId: { contains: q } },
      ];
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (filter === "active") where.lastActiveAt = { gte: weekAgo };
    if (filter === "inactive") where.lastActiveAt = { lt: weekAgo };
    if (filter === "blocked") where.isBlocked = true;
    if (filter === "admins") where.role = "ADMIN";

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: sort === "new" ? { createdAt: "desc" } : { lastActiveAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          telegramId: true,
          firstName: true,
          lastName: true,
          username: true,
          role: true,
          isBlocked: true,
          blockedBot: true,
          lastActiveAt: true,
          createdAt: true,
          _count: { select: { transactions: true, debts: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Faqat shu sahifadagi 20 ta foydalanuvchi uchun tushum/xarajat (userId indekslangan) — butun jadval emas.
    const sums = await prisma.transaction.groupBy({
      by: ["userId", "type"],
      where: { userId: { in: users.map(u => u.id) } },
      _sum: { amount: true },
    });
    const fin = new Map<string, { income: number; expense: number }>();
    for (const r of sums) {
      const f = fin.get(r.userId) ?? { income: 0, expense: 0 };
      if (r.type === "INCOME") f.income = Number(r._sum.amount ?? 0); else f.expense = Number(r._sum.amount ?? 0);
      fin.set(r.userId, f);
    }
    let rows = users.map(u => ({ ...u, finance: fin.get(u.id) ?? { income: 0, expense: 0 } }));
    if (sort === "volume") rows = rows.sort((a, b) => (b.finance.income + b.finance.expense) - (a.finance.income + a.finance.expense));
    return etagJson(req, { users: rows, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    return adminError(e);
  }
}