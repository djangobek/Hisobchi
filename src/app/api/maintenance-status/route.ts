import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const [mode, message] = await Promise.all([
    prisma.appSetting.findUnique({ where: { key: "maintenance_mode" } }),
    prisma.appSetting.findUnique({ where: { key: "maintenance_message" } }),
  ]);
  return NextResponse.json({
    enabled: mode?.value === "true",
    message: message?.value ?? "🛠 Botda texnik ishlar ketmoqda.",
  });
}