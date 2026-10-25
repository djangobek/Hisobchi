import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const snapshotSchema = z.object({
  categories: z.array(z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(80), type: z.enum(["INCOME","EXPENSE"]), color: z.string().max(32).optional(), icon: z.string().max(40).optional() })).max(200),
  transactions: z.array(z.object({ id: z.string().min(1), amount: z.coerce.number().finite().positive(), type: z.enum(["INCOME","EXPENSE"]), categoryId: z.string().min(1), note: z.string().max(500).optional().nullable(), occurredAt: z.coerce.date() })).max(10000),
  debts: z.array(z.object({ id: z.string().min(1), personName: z.string().trim().min(1).max(120), direction: z.enum(["LENT","BORROWED"]), originalAmount: z.coerce.number().finite().positive(), occurredAt: z.coerce.date(), dueAt: z.coerce.date().optional().nullable(), note: z.string().max(500).optional().nullable(), repayments: z.array(z.coerce.number().positive()).max(1000), repaymentDates: z.array(z.coerce.date()).max(1000).optional() })).max(5000)
});

async function auth(req: NextRequest) {
  const user = await getAuthUser(req);
  return user;
}
function fail(e: unknown) {
  const message = e instanceof Error ? e.message : "So‘rov bajarilmadi.";
  return NextResponse.json({ error: message }, { status: /sessiyasi|Foydalanuvchi|bloklangan|Ruxsat/i.test(message) ? 401 : 400, headers: { "Cache-Control": "no-store" } });
}

async function ensureDefaults(userId: string) {
  const defaults = [
    ["Ovqatlanish","EXPENSE","#f97316"],["Oziq-ovqat","EXPENSE","#eab308"],["Transport","EXPENSE","#3b82f6"],["Uy-joy","EXPENSE","#8b5cf6"],["Kiyim-kechak","EXPENSE","#ec4899"],["Ta'lim","EXPENSE","#06b6d4"],["Sog'liq","EXPENSE","#ef4444"],["Ko'ngilochar","EXPENSE","#a855f7"],["Boshqa","EXPENSE","#64748b"],
    ["Ish haqi","INCOME","#22c55e"],["Qo'shimcha ish","INCOME","#16a34a"],["Freelance","INCOME","#10b981"],["Savdo","INCOME","#14b8a8"],["Sovg'a","INCOME","#84cc16"],["Boshqa tushum","INCOME","#4ade80"]
  ] as const;
  await prisma.$transaction(defaults.map(([name,type,color]) => prisma.category.upsert({
    where: { userId_name_type: { userId, name, type } },
    update: {},
    create: { userId, name, type, color, isDefault: true }
  })));
}

export async function GET(req: NextRequest) {
  try {
    const user = await auth(req);
    await ensureDefaults(user.id);
    const [categories, transactions, debts] = await Promise.all([
      prisma.category.findMany({ where: { userId: user.id }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] }),
      prisma.transaction.findMany({ where: { userId: user.id }, include: { category: true }, orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }], take: 10000 }),
      prisma.debt.findMany({ where: { userId: user.id }, include: { payments: { orderBy: { paidAt: "asc" } } }, orderBy: { occurredAt: "desc" }, take: 5000 })
    ]);
    return NextResponse.json({
      categories: categories.map(c => ({ id:c.id, name:c.name, type:c.type, color:c.color, icon:"other" })),
      transactions: transactions.map(t => ({ id:t.id, amount:Number(t.amount), type:t.type, categoryId:t.categoryId, note:t.note ?? "", occurredAt:t.occurredAt.toISOString() })),
      debts: debts.map(d => ({ id:d.id, personName:d.personName, direction:d.direction, originalAmount:Number(d.originalAmount), occurredAt:d.occurredAt.toISOString(), dueAt:d.dueAt?.toISOString(), note:d.note ?? "", repayments:d.payments.map(p=>Number(p.amount)), repaymentDates:d.payments.map(p=>p.paidAt.toISOString()) }))
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return fail(e); }
}

/**
 * Authenticated, owner-scoped reconciliation endpoint. Only rows belonging to the current
 * Telegram user are updated/deleted; unknown client IDs are never trusted as database IDs.
 * The whole snapshot is committed in one DB transaction, preventing partial saves.
 */
export async function PUT(req: NextRequest) {
  try {
    const user = await auth(req);
    const data = snapshotSchema.parse(await req.json());
    await ensureDefaults(user.id);
    await prisma.$transaction(async tx => {
      const existingCategories = await tx.category.findMany({ where: { userId: user.id } });
      const categoryIdMap = new Map<string,string>();
      for (const c of data.categories) {
        const old = existingCategories.find(x => x.id === c.id);
        const match = old ?? await tx.category.findFirst({ where: { userId:user.id, name:c.name, type:c.type } });
        if (match) {
          const updated = await tx.category.update({ where:{id:match.id}, data:{name:c.name,type:c.type,color:c.color ?? match.color} });
          categoryIdMap.set(c.id,updated.id);
        } else {
          const created = await tx.category.create({ data:{userId:user.id,name:c.name,type:c.type,color:c.color ?? "#64748b"} });
          categoryIdMap.set(c.id,created.id);
        }
      }
      // Existing records can only be mutated/deleted when the DB confirms ownership.
      const oldTx = await tx.transaction.findMany({ where:{userId:user.id}, select:{id:true} });
      const keepTx = new Set<string>();
      for (const item of data.transactions) {
        const categoryId = categoryIdMap.get(item.categoryId) ?? (existingCategories.some(c=>c.id===item.categoryId) ? item.categoryId : undefined);
        if (!categoryId) throw new Error("Tranzaksiya kategoriyasi topilmadi yoki sizga tegishli emas.");
        const category = await tx.category.findFirst({where:{id:categoryId,userId:user.id,type:item.type}});
        if (!category) throw new Error("Kategoriya turi mos emas.");
        const values = {amount:new Prisma.Decimal(item.amount),type:item.type,categoryId:category.id,note:item.note ?? null,occurredAt:item.occurredAt};
        if (oldTx.some(x=>x.id===item.id)) {
          await tx.transaction.update({where:{id:item.id,userId:user.id},data:values});
          keepTx.add(item.id);
        } else {
          const created = await tx.transaction.create({data:{...values,userId:user.id}});
          keepTx.add(created.id);
        }
      }
      await tx.transaction.deleteMany({where:{userId:user.id,id:{notIn:[...keepTx]}}});

      const oldDebts = await tx.debt.findMany({where:{userId:user.id},include:{payments:true}});
      const keepDebts = new Set<string>();
      for (const d of data.debts) {
        const values = {personName:d.personName,direction:d.direction,originalAmount:new Prisma.Decimal(d.originalAmount),occurredAt:d.occurredAt,dueAt:d.dueAt ?? null,note:d.note ?? null,status:"OPEN" as const};
        const old = oldDebts.find(x=>x.id===d.id);
        let debtId: string;
        if (old) {
          const updated = await tx.debt.update({where:{id:old.id,userId:user.id},data:values});
          debtId=updated.id;
          await tx.debtPayment.deleteMany({where:{debtId}});
        } else {
          const created = await tx.debt.create({data:{...values,userId:user.id}});
          debtId=created.id;
        }
        let total=0;
        for (let i=0;i<d.repayments.length;i++) {
          const amount=d.repayments[i];
          total += amount;
          await tx.debtPayment.create({data:{debtId,amount:new Prisma.Decimal(amount),paidAt:d.repaymentDates?.[i] ?? new Date(),note:null}});
        }
        const remaining=Number(d.originalAmount)-total;
        await tx.debt.update({where:{id:debtId},data:{status:remaining<=0?"PAID":total>0?"PARTIAL":"OPEN"}});
        keepDebts.add(debtId);
      }
      await tx.debt.deleteMany({where:{userId:user.id,id:{notIn:[...keepDebts]}}});
      // Remove obsolete non-default categories only if they have no remaining transactions.
      await tx.category.deleteMany({where:{userId:user.id,isDefault:false,id:{notIn:[...categoryIdMap.values()]},transactions:{none:{}}}});
    }, { timeout: 20000, maxWait: 5000 });
    return NextResponse.json({ success:true, savedAt:new Date().toISOString() }, {headers:{"Cache-Control":"no-store"}});
  } catch(e) { return fail(e); }
}
