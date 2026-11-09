/** Takroriy Telegram update'lar va qayta ishlangan audio/xabarlardan himoya (xotirada, TTL bilan). */
import type { Context, NextFunction } from "grammy";
import { CFG } from "./config";

export class TtlSet {
  private m = new Map<string, number>();
  constructor(private readonly ttlMs: number, private readonly max = 5000) {}
  private sweep(now: number) {
    if (this.m.size <= this.max) return;
    for (const [k, t] of this.m) if (now - t > this.ttlMs) this.m.delete(k);
    // hali ham to'lib ketgan bo'lsa — eng eskilarini olib tashlaymiz
    while (this.m.size > this.max) { const first = this.m.keys().next().value; if (first === undefined) break; this.m.delete(first); }
  }
  has(key: string, now = Date.now()) { const t = this.m.get(key); return t !== undefined && now - t <= this.ttlMs; }
  /** Yangi bo'lsa qo'shadi va true qaytaradi; avval ko'rilgan bo'lsa false. */
  add(key: string, now = Date.now()): boolean {
    if (this.has(key, now)) return false;
    this.m.set(key, now); this.sweep(now);
    return true;
  }
  delete(key: string) { this.m.delete(key); }
}

const seenUpdates = new TtlSet(CFG.dedupTtlMs);

/** Bir xil update_id ikki marta kelsa (qayta yetkazish) ikkinchisi e'tiborsiz qoldiriladi. */
export async function updateDedup(ctx: Context, next: NextFunction): Promise<void> {
  const id = ctx.update.update_id;
  if (typeof id === "number" && !seenUpdates.add(`u:${id}`)) {
    console.warn(`[DEDUP] takroriy update ${id} e'tiborsiz qoldirildi`);
    return;
  }
  await next();
}
