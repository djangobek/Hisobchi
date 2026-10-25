import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { swr, invalidate } from "@/lib/admin-cache";
import { loadStatsWithSnapshot } from "@/lib/admin-stats";
import { rateLimit } from "@/lib/rate-limit";
import { etagJson, adminError } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Qatlamlar: xotira keshi (30s, +2 daqiqa stale) -> Postgres snapshot (5 daqiqa) -> hisoblash.
 * `?refresh=1` — snapshotni majburan yangilaydi (rate-limit bilan himoyalangan).
 */
export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    rateLimit(`stats:${admin.id}`, 20, 0.5);
    const force = req.nextUrl.searchParams.get("refresh") === "1";
    if (force) rateLimit(`stats-refresh:${admin.id}`, 3, 1 / 20);
    if (force) invalidate("stats");
    const { value, cache, ageMs } = await swr("stats", 30_000, 120_000, () => loadStatsWithSnapshot(force));
    return etagJson(req, value, { extra: { "X-Cache": cache, "X-Cache-Age": String(ageMs) } });
  } catch (e) {
    return adminError(e);
  }
}
