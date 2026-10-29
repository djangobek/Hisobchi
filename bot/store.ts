/** Ma'lumotlar bazasi bilan ishlash: kontekst, rejalashtirish (qarz qaytarishni moslash), saqlash, statistika. */
import { PrismaClient } from "@prisma/client";
import type { DraftOp, NluContext } from "./nlu";
import { OTHER_DEFAULT, resolveCategory, type CatInfo } from "../src/lib/category-match";
import { monthRangeTashkent, nameKey, sameName, startOfDay, todayTashkent, addDays } from "./util";

export const prisma = new PrismaClient();

/** Web-ilovadagi standart kategoriyalar bilan bir xil (src/app/api/data/route.ts → ensureDefaults). */
const DEFAULT_CATEGORIES = [
  ["Ovqatlanish", "EXPENSE", "#f97316"], ["Oziq-ovqat", "EXPENSE", "#eab308"], ["Transport", "EXPENSE", "#3b82f6"], ["Uy-joy", "EXPENSE", "#8b5cf6"],
  ["Kiyim-kechak", "EXPENSE", "#ec4899"], ["Ta'lim", "EXPENSE", "#06b6d4"], ["Sog'liq", "EXPENSE", "#ef4444"], ["Ko'ngilochar", "EXPENSE", "#a855f7"], ["Boshqa", "EXPENSE", "#64748b"],
  ["Ish haqi", "INCOME", "#22c55e"], ["Qo'shimcha ish", "INCOME", "#16a34a"], ["Freelance", "INCOME", "#10b981"], ["Savdo", "INCOME", "#14b8a8"], ["Sovg'a", "INCOME", "#84cc16"], ["Boshqa tushum", "INCOME", "#4ade80"],
] as const;

export type Allocation = { debtId: string; personName: string; apply: number; remainingAfter: number };
export type PlannedOp = DraftOp & {
  allocations?: Allocation[];
  problem?: "nodebt" | "ambiguous";
  capped?: number; // qarzdan ortiq summa (qaytarilmagan qism)
};

const paidOf = (d: { payments: { amount: unknown }[] }) => d.payments.reduce((s, p) => s + Number(p.amount), 0);
export const remainingOf = (d: { originalAmount: unknown; payments: { amount: unknown }[] }) => Math.max(0, Number(d.originalAmount) - paidOf(d));

/** Foydalanuvchida umuman kategoriya bo'lmasa (ilovani hali ochmagan), standart ro'yxatni yaratadi. */
async function ensureDefaultCategories(userId: string): Promise<void> {
  await prisma.$transaction(DEFAULT_CATEGORIES.map(([name, type, color]) => prisma.category.upsert({
    where: { userId_name_type: { userId, name, type } }, update: {}, create: { userId, name, type, color, isDefault: true },
  })));
}

export async function loadUserCategories(userId: string): Promise<CatInfo[]> {
  let rows = await prisma.category.findMany({ where: { userId }, select: { id: true, name: true, type: true }, orderBy: { name: "asc" } });
  if (!rows.length) { await ensureDefaultCategories(userId); rows = await prisma.category.findMany({ where: { userId }, select: { id: true, name: true, type: true }, orderBy: { name: "asc" } }); }
  return rows;
}

/** NLU konteksti: faqat foydalanuvchining HAQIQIY kategoriyalari (standart ro'yxat aralashtirilmaydi). */
export async function loadContext(userId: string): Promise<NluContext> {
  const [categories, debts] = await Promise.all([
    loadUserCategories(userId),
    prisma.debt.findMany({ where: { userId }, select: { personName: true }, orderBy: { updatedAt: "desc" }, take: 60 }),
  ]);
  const uniq = (a: string[]) => [...new Set(a)];
  return {
    categories,
    expenseCategories: categories.filter(c => c.type === "EXPENSE").map(c => c.name),
    incomeCategories: categories.filter(c => c.type === "INCOME").map(c => c.name),
    knownPeople: uniq(debts.map(d => d.personName)),
  };
}

/** Qarz qaytarishlarni ochiq qarzlarga moslaydi (eng eskisidan boshlab), ismni kanonik shaklga keltiradi. */
export async function planOperations(userId: string, ops: DraftOp[], db: { debt: PrismaClient["debt"] } = prisma): Promise<PlannedOp[]> {
  const open = await db.debt.findMany({ where: { userId, status: { not: "PAID" } }, include: { payments: true }, orderBy: { occurredAt: "asc" } });
  const known = await db.debt.findMany({ where: { userId }, select: { personName: true }, take: 200 });
  const left = new Map<string, number>(open.map(d => [d.id, remainingOf(d)] as [string, number]));

  return ops.map((op): PlannedOp => {
    if (op.kind === "DEBT_LENT" || op.kind === "DEBT_BORROWED") {
      const canon = known.find(k => sameName(k.personName, op.person ?? ""))?.personName;
      return { ...op, person: canon ?? op.person };
    }
    if (op.kind !== "REPAY_IN" && op.kind !== "REPAY_OUT") return { ...op };

    const direction = op.kind === "REPAY_IN" ? "LENT" : "BORROWED";
    const cands = open.filter(d => d.direction === direction && sameName(d.personName, op.person ?? "") && (left.get(d.id) ?? 0) > 0);
    if (!cands.length) return { ...op, problem: "nodebt" };
    const keys = new Set(cands.map(d => nameKey(d.personName)));
    const exact = cands.filter(d => nameKey(d.personName) === nameKey(op.person ?? ""));
    const use = keys.size > 1 ? (exact.length ? exact : []) : cands;
    if (!use.length) return { ...op, problem: "ambiguous" };

    let rest = op.amount; const allocations: Allocation[] = [];
    for (const d of use) {
      if (rest <= 0) break;
      const avail = left.get(d.id) ?? 0;
      const apply = Math.min(avail, rest);
      if (apply <= 0) continue;
      left.set(d.id, avail - apply); rest -= apply;
      allocations.push({ debtId: d.id, personName: d.personName, apply, remainingAfter: avail - apply });
    }
    return { ...op, person: use[0].personName, allocations, capped: rest > 0 ? rest : undefined };
  });
}

export type CommitResult = { saved: number; skipped: number; txCount: number; debtCount: number; repayCount: number };

export async function commitOperations(userId: string, tokenId: string, ops: DraftOp[]): Promise<CommitResult> {
  return prisma.$transaction(async tx => {
    // Saqlash paytida qarz holati qayta tekshiriladi (draft va saqlash orasida o'zgargan bo'lishi mumkin).
    const planned = await planOperations(userId, ops, tx as any);
    const r: CommitResult = { saved: 0, skipped: 0, txCount: 0, debtCount: 0, repayCount: 0 };
    // Kategoriyalar saqlash paytida qayta o'qiladi: draft davomida o'chirilgan/qo'shilgan bo'lishi mumkin.
    const cats: CatInfo[] = await tx.category.findMany({ where: { userId }, select: { id: true, name: true, type: true } });
    for (let i = 0; i < planned.length; i++) {
      const op = planned[i];
      if (op.problem) { r.skipped++; continue; }
      if (op.kind === "INCOME" || op.kind === "EXPENSE") {
        // Faqat mavjud kategoriyaga yoziladi; topilmasa "Boshqa" (u ham yo'q bo'lsa — standart "Boshqa" yaratiladi).
        const m = resolveCategory(op.category, op.kind, cats, op.note);
        const category = m.id ? { id: m.id } : await tx.category.upsert({
          where: { userId_name_type: { userId, name: m.name || OTHER_DEFAULT[op.kind], type: op.kind } },
          update: {}, create: { userId, name: m.name || OTHER_DEFAULT[op.kind], type: op.kind, color: "#64748b", isDefault: true },
        });
        await tx.transaction.create({ data: {
          userId, amount: op.amount, type: op.kind, categoryId: category.id, note: op.note,
          occurredAt: startOfDay(op.date), requestKey: `voice:${tokenId}:${i}`,
        } });
        r.txCount++; r.saved++;
      } else if (op.kind === "DEBT_LENT" || op.kind === "DEBT_BORROWED") {
        await tx.debt.create({ data: {
          userId, personName: op.person!, direction: op.kind === "DEBT_LENT" ? "LENT" : "BORROWED", originalAmount: op.amount,
          occurredAt: startOfDay(op.date), dueAt: op.dueDate ? startOfDay(op.dueDate) : null, note: op.note || null, status: "OPEN",
        } });
        r.debtCount++; r.saved++;
      } else {
        for (const a of op.allocations ?? []) {
          await tx.debtPayment.create({ data: { debtId: a.debtId, amount: a.apply, paidAt: startOfDay(op.date), note: op.note || null } });
          await tx.debt.update({ where: { id: a.debtId }, data: { status: a.remainingAfter <= 0 ? "PAID" : "PARTIAL" } });
        }
        r.repayCount++; r.saved++;
      }
    }
    return r;
  }, { timeout: 20_000 });
}

/* ---------------- Statistika ---------------- */

export async function sumRange(userId: string, start: Date, end: Date) {
  const g = await prisma.transaction.groupBy({ by: ["type"], where: { userId, occurredAt: { gte: start, lt: end } }, _sum: { amount: true }, _count: true });
  const pick = (t: "INCOME" | "EXPENSE") => Number(g.find(x => x.type === t)?._sum.amount ?? 0);
  return { income: pick("INCOME"), expense: pick("EXPENSE"), count: g.reduce((s, x) => s + x._count, 0) };
}

export async function topCategories(userId: string, start: Date, end: Date, type: "INCOME" | "EXPENSE" = "EXPENSE", take = 6) {
  const g = await prisma.transaction.groupBy({ by: ["categoryId"], where: { userId, type, occurredAt: { gte: start, lt: end } }, _sum: { amount: true }, orderBy: { _sum: { amount: "desc" } }, take });
  if (!g.length) return [];
  const cats = await prisma.category.findMany({ where: { id: { in: g.map(x => x.categoryId) } }, select: { id: true, name: true } });
  return g.map(x => ({ name: cats.find(c => c.id === x.categoryId)?.name ?? "—", total: Number(x._sum.amount ?? 0) }));
}

export async function dailyExpenses(userId: string, days: number) {
  const today = todayTashkent();
  const from = addDays(today, -(days - 1));
  const rows = await prisma.transaction.findMany({ where: { userId, type: "EXPENSE", occurredAt: { gte: startOfDay(from), lt: startOfDay(addDays(today, 1)) } }, select: { amount: true, occurredAt: true } });
  const map = new Map<string, number>();
  for (let i = 0; i < days; i++) map.set(addDays(from, i), 0);
  for (const r of rows) { const k = r.occurredAt.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" }); if (map.has(k)) map.set(k, map.get(k)! + Number(r.amount)); }
  return [...map.entries()].map(([date, total]) => ({ date, total }));
}

export async function allTimeBalance(userId: string) {
  const g = await prisma.transaction.groupBy({ by: ["type"], where: { userId }, _sum: { amount: true } });
  const pick = (t: "INCOME" | "EXPENSE") => Number(g.find(x => x.type === t)?._sum.amount ?? 0);
  return { income: pick("INCOME"), expense: pick("EXPENSE") };
}

export async function recentTransactions(userId: string, take = 5) {
  return prisma.transaction.findMany({ where: { userId }, include: { category: { select: { name: true } } }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take });
}

export async function openDebts(userId: string) {
  const rows = await prisma.debt.findMany({ where: { userId, status: { not: "PAID" } }, include: { payments: true }, orderBy: { occurredAt: "asc" } });
  return rows.map(d => ({ id: d.id, person: d.personName, direction: d.direction, original: Number(d.originalAmount), remaining: remainingOf(d), dueAt: d.dueAt, note: d.note }))
    .filter(d => d.remaining > 0);
}

/* ---------------- Sozlamalar (AppSetting, migratsiyasiz) ---------------- */

export const getSetting = async (key: string) => (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
export const setSetting = (key: string, value: string) => prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
export const delSetting = (key: string) => prisma.appSetting.deleteMany({ where: { key } });
export const budgetKey = (userId: string) => `bot_budget:${userId}`;
export const reminderKey = (userId: string) => `bot_reminder:${userId}`;

export async function budgetStatus(userId: string) {
  const raw = await getSetting(budgetKey(userId));
  const budget = raw ? Number(raw) : 0;
  if (!budget) return null;
  const { start, end } = monthRangeTashkent();
  const { expense } = await sumRange(userId, start, end);
  return { budget, spent: expense, ratio: expense / budget };
}
