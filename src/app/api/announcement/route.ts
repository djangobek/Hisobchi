import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, requireAdmin, logAdminAction } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const KEY = "public_announcement";
const schema = z.object({ title: z.string().trim().min(1).max(160), message: z.string().trim().min(1).max(4000), active: z.boolean().default(true) });

export async function GET(req: NextRequest) {
  try {
    await getAuthUser(req);
    const row = await prisma.appSetting.findUnique({ where: { key: KEY } });
    const parsed = row ? JSON.parse(row.value) : null;
    return NextResponse.json(parsed && parsed.active ? parsed : null, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const data = schema.parse(await req.json());
    const value = JSON.stringify({ ...data, updatedAt: new Date().toISOString() });
    await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
    await logAdminAction(admin.id, "announcement_update", undefined, { active: data.active, title: data.title });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "So‘rov bajarilmadi." }, { status: 400 });
  }
}
