import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { adminError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s; // CSV/Excel formula injection'dan himoya
  return `"${s.replace(/"/g, '""')}"`;
};

/**
 * Texnologiya #5: Streaming CSV eksport + keyset (cursor) pagination.
 * 100k foydalanuvchi bo'lsa ham xotira to'lmaydi: 500 tadan bo'lib oqim bilan yuboriladi.
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    rateLimit(`export:${admin.id}`, 2, 1 / 60);
    await logAdminAction(admin.id, "export_users_csv");
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      async start(ctrl) {
        ctrl.enqueue(enc.encode("﻿telegramId,ism,username,rol,bloklangan,tranzaksiyalar,tushum,xarajat,royxatdan,oxirgi_faollik\n"));
        let cursor: string | undefined;
        for (;;) {
          const batch = await prisma.user.findMany({
            take: 500, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: { id: "asc" },
            select: { id: true, telegramId: true, firstName: true, lastName: true, username: true, role: true, isBlocked: true, createdAt: true, lastActiveAt: true, _count: { select: { transactions: true } } },
          });
          if (!batch.length) break;
          const sums = await prisma.transaction.groupBy({ by: ["userId", "type"], where: { userId: { in: batch.map(b => b.id) } }, _sum: { amount: true } });
          const m = new Map<string, [number, number]>();
          for (const r of sums) { const x = m.get(r.userId) ?? [0, 0]; x[r.type === "INCOME" ? 0 : 1] = Number(r._sum.amount ?? 0); m.set(r.userId, x); }
          ctrl.enqueue(enc.encode(batch.map(u => {
            const [i, e] = m.get(u.id) ?? [0, 0];
            return [u.telegramId, [u.firstName, u.lastName].filter(Boolean).join(" "), u.username, u.role, u.isBlocked, u._count.transactions, i, e, u.createdAt.toISOString(), u.lastActiveAt.toISOString()].map(esc).join(",");
          }).join("\n") + "\n"));
          cursor = batch[batch.length - 1].id;
        }
        ctrl.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="users-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
  } catch (e) {
    return adminError(e);
  }
}
