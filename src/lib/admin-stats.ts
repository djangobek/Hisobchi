import { prisma } from "./prisma";

export type AdminStats = {
  users: { total: number; activeWeek: number; activeMonth: number; blocked: number; blockedBot: number; newWeek: number };
  transactions: { total: number };
  debts: { total: number; open: number };
  topUsers: { id: string; name: string; income: number; expense: number; count: number }[];
  recentUsers: any[];
  topCategories: any[];
  computedAt: string;
};

const SNAP_KEY = "overview";
export const SNAP_MAX_AGE_MS = 5 * 60_000;

/** Barcha og'ir hisob: 12 ta emas, 5 ta (asosan bitta SQL'ga jamlangan) so'rov. */
export async function computeStats(): Promise<AdminStats> {
  const [u, t, d, top, recentUsers, topCategories] = await Promise.all([
    prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int total,
        COUNT(*) FILTER (WHERE "lastActiveAt" >= now() - interval '7 days')::int "activeWeek",
        COUNT(*) FILTER (WHERE "lastActiveAt" >= now() - interval '30 days')::int "activeMonth",
        COUNT(*) FILTER (WHERE "isBlocked")::int blocked,
        COUNT(*) FILTER (WHERE "blockedBot")::int "blockedBot",
        COUNT(*) FILTER (WHERE "createdAt" >= now() - interval '7 days')::int "newWeek"
      FROM "User"`,
    prisma.transaction.count(),
    prisma.$queryRaw<any[]>`
      SELECT COUNT(*)::int total, COUNT(*) FILTER (WHERE status <> 'PAID')::int open FROM "Debt"`,
    prisma.$queryRaw<any[]>`
      SELECT t."userId" id, COALESCE(NULLIF(trim(concat(u."firstName",' ',u."lastName")),''), u.username, 'Noma''lum') name,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type='INCOME'),0)::float8 income,
        COALESCE(SUM(t.amount) FILTER (WHERE t.type='EXPENSE'),0)::float8 expense,
        COUNT(*)::int count
      FROM "Transaction" t JOIN "User" u ON u.id=t."userId"
      GROUP BY t."userId", u."firstName", u."lastName", u.username
      ORDER BY SUM(t.amount) DESC LIMIT 5`,
    prisma.user.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, firstName: true, lastName: true, username: true, telegramId: true, createdAt: true, role: true },
    }),
    prisma.category.findMany({
      where: { type: "EXPENSE" },
      select: { name: true, color: true, _count: { select: { transactions: true } } },
      orderBy: { transactions: { _count: "desc" } }, take: 8,
    }),
  ]);
  return {
    users: u[0],
    transactions: { total: t },
    debts: d[0],
    topUsers: top as any,
    recentUsers, topCategories,
    computedAt: new Date().toISOString(),
  };
}

/** Avval Postgres snapshot'ga qaraydi (server restartdan keyin ham tez), eskirgan bo'lsa qayta hisoblaydi. */
export async function loadStatsWithSnapshot(force = false): Promise<AdminStats> {
  if (!force) {
    // Snapshot jadvali yo'q bo'lsa (migratsiya qilinmagan) ham panel ishlayveradi
    const snap = await (async () => { try { return await prisma.adminStatsSnapshot.findUnique({ where: { key: SNAP_KEY } }); } catch { return null; } })();
    if (snap && Date.now() - snap.computedAt.getTime() < SNAP_MAX_AGE_MS) return snap.payload as unknown as AdminStats;
  }
  const fresh = await computeStats();
  try {
    await prisma.adminStatsSnapshot.upsert({ where: { key: SNAP_KEY }, create: { key: SNAP_KEY, payload: fresh as any }, update: { payload: fresh as any, computedAt: new Date() } });
  } catch { /* snapshot saqlanmasa ham javob qaytadi */ }
  return fresh;
}
