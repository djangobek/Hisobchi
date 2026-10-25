/**
 * Texnologiya #2: Token-bucket rate limiter (admin API'ni suiiste'mol va tasodifiy
 * "refresh-storm"dan himoya qiladi). Xotirada, qo'shimcha servis talab qilmaydi.
 */
type Bucket = { tokens: number; last: number };
const buckets = new Map<string, Bucket>();

export class RateLimitError extends Error {
  constructor(public retryAfterSec: number) { super("Juda ko'p so'rov. Biroz kuting."); }
}

export function rateLimit(key: string, capacity = 30, refillPerSec = 1) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, last: now };
  b.tokens = Math.min(capacity, b.tokens + ((now - b.last) / 1000) * refillPerSec);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    throw new RateLimitError(Math.ceil((1 - b.tokens) / refillPerSec));
  }
  b.tokens -= 1;
  buckets.set(key, b);
  if (buckets.size > 5000) { // xotira to'lib ketmasligi uchun
    for (const [k, v] of buckets) if (now - v.last > 10 * 60_000) buckets.delete(k);
  }
}
