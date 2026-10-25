import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const checks: Record<string, { status: "ok" | "warning" | "error"; detail: string; latencyMs?: number }> = {};
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = { status: "ok", detail: "PostgreSQL bilan aloqa mavjud", latencyMs: Date.now() - dbStart };
    } catch {
      checks.database = { status: "error", detail: "Bazaga ulanib bo‘lmadi" };
    }
    checks.bot = process.env.BOT_TOKEN
      ? { status: "ok", detail: "BOT_TOKEN sozlangan (token ko‘rsatilmaydi)" }
      : { status: "warning", detail: "BOT_TOKEN sozlanmagan" };
    checks.webApp = process.env.WEB_APP_URL
      ? { status: "ok", detail: "WEB_APP_URL sozlangan" }
      : { status: "warning", detail: "WEB_APP_URL sozlanmagan" };
    const dbOk = checks.database.status === "ok";
    return NextResponse.json({
      status: dbOk ? "ok" : "degraded",
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      environment: process.env.NODE_ENV ?? "unknown",
      nodeVersion: process.version,
      memory: { rssBytes: process.memoryUsage().rss, heapUsedBytes: process.memoryUsage().heapUsed, heapTotalBytes: process.memoryUsage().heapTotal },
      checks,
    }, { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Server holatini tekshirib bo‘lmadi." }, { status: 403 });
  }
}
