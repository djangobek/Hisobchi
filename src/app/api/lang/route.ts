import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ language: z.enum(["uz", "ru"]) });

/** Foydalanuvchi tilini saqlaydi — bot va AI javoblari ham shu tilda bo'ladi. */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    const { language } = schema.parse(await req.json());
    if (user.language !== language) await prisma.user.update({ where: { id: user.id }, data: { language } });
    return NextResponse.json({ language }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "So‘rov bajarilmadi." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
