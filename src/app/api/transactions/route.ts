import { NextRequest,NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transactionSchema } from "@/lib/validation";
import { getAuthUser } from "@/lib/auth";
export const runtime="nodejs";
async function authenticated(req:NextRequest){ return getAuthUser(req); }
export async function GET(req:NextRequest){try{const user=await authenticated(req);const from=req.nextUrl.searchParams.get("from"),to=req.nextUrl.searchParams.get("to");const rows=await prisma.transaction.findMany({where:{userId:user.id,...(from||to?{occurredAt:{...(from?{gte:new Date(from)}:{}),...(to?{lt:new Date(to)}:{})}}:{})},include:{category:{select:{id:true,name:true,type:true}}},orderBy:{occurredAt:"desc"},take:500});return NextResponse.json(rows);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"So‘rov bajarilmadi."},{status:401});}}
export async function POST(req:NextRequest){try{const user=await authenticated(req);const input=transactionSchema.parse(await req.json());const category=await prisma.category.findFirst({where:{id:input.categoryId,userId:user.id,type:input.type}});if(!category)return NextResponse.json({error:"Kategoriya topilmadi."},{status:400});if(input.accountId){const account=await prisma.account.findFirst({where:{id:input.accountId,userId:user.id}});if(!account)return NextResponse.json({error:"Hisob topilmadi."},{status:400});}if (input.requestKey) {
  const existing = await prisma.transaction.findUnique({ where: { userId_requestKey: { userId: user.id, requestKey: input.requestKey } }, include: { category: true } });
  if (existing) return NextResponse.json(existing, { status: 200 });
}
const row=await prisma.transaction.create({data:{userId:user.id,amount:input.amount,type:input.type,categoryId:category.id,accountId:input.accountId||null,note:input.note,occurredAt:input.occurredAt,requestKey:input.requestKey},include:{category:true}});return NextResponse.json(row,{status:201});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Ma’lumotlarni saqlashda xatolik."},{status:400});}}
/** Update a single operation without replacing the user's complete data snapshot. */
export async function PUT(req: NextRequest) {
  try {
    const user = await authenticated(req);
    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "Tranzaksiya ID talab qilinadi." }, { status: 400 });
    const input = transactionSchema.parse(body);
    const category = await prisma.category.findFirst({ where: { id: input.categoryId, userId: user.id, type: input.type } });
    if (!category) return NextResponse.json({ error: "Kategoriya topilmadi yoki turi mos emas." }, { status: 400 });
    if (input.accountId) {
      const account = await prisma.account.findFirst({ where: { id: input.accountId, userId: user.id } });
      if (!account) return NextResponse.json({ error: "Hisob topilmadi." }, { status: 400 });
    }
    const result = await prisma.transaction.updateMany({ where: { id, userId: user.id }, data: { amount: input.amount, type: input.type, categoryId: category.id, accountId: input.accountId || null, note: input.note || null, occurredAt: input.occurredAt } });
    if (!result.count) return NextResponse.json({ error: "Tranzaksiya topilmadi." }, { status: 404 });
    const row = await prisma.transaction.findFirst({ where: { id, userId: user.id }, include: { category: true } });
    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Ma’lumotlarni yangilashda xatolik." }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticated(req);
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Tranzaksiya ID talab qilinadi." }, { status: 400 });
    const result = await prisma.transaction.deleteMany({ where: { id, userId: user.id } });
    if (!result.count) return NextResponse.json({ error: "Tranzaksiya topilmadi." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Tranzaksiyani o‘chirishda xatolik." }, { status: 400 });
  }
}
