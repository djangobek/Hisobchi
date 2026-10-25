import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, logAdminAction } from "@/lib/auth";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const [mode, message] = await Promise.all([
      prisma.appSetting.findUnique({ where: { key: "maintenance_mode" } }),
      prisma.appSetting.findUnique({ where: { key: "maintenance_message" } }),
    ]);
    return NextResponse.json({
      enabled: mode?.value === "true",
      message: message?.value ?? "",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Xatolik." }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const data = z.object({
      enabled: z.boolean(),
      message: z.string().max(500).optional(),
    }).parse(await req.json());

    await prisma.appSetting.upsert({
      where: { key: "maintenance_mode" },
      update: { value: String(data.enabled) },
      create: { key: "maintenance_mode", value: String(data.enabled) },
    });
    if (data.message !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: "maintenance_message" },
        update: { value: data.message },
        create: { key: "maintenance_message", value: data.message },
      });
    }
    await logAdminAction(admin.id, "maintenance", undefined, { enabled: data.enabled });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Xatolik." }, { status: 403 });
  }
}