/**
 * Texnologiya #1: Single-flight + stale-while-revalidate (SWR) server keshi.
 * - Bir vaqtda 100 ta so'rov kelsa ham og'ir hisob BIR marta bajariladi (single-flight).
 * - Eskirgan (stale) javob darhol qaytadi, yangilash fonda ketadi.
 */
type Entry<T> = { value: T; at: number };
const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function swr<T>(
  key: string,
  ttlMs: number,
  staleMs: number,
  loader: () => Promise<T>
): Promise<{ value: T; cache: "hit" | "stale" | "miss"; ageMs: number }> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;

  const refresh = () => {
    let p = inflight.get(key) as Promise<T> | undefined;
    if (!p) {
      p = loader()
        .then(v => { store.set(key, { value: v, at: Date.now() }); return v; })
        .finally(() => inflight.delete(key));
      inflight.set(key, p);
    }
    return p;
  };

  if (hit) {
    const age = now - hit.at;
    if (age < ttlMs) return { value: hit.value, cache: "hit", ageMs: age };
    if (age < ttlMs + staleMs) {
      void refresh().catch(() => {}); // fonda yangilanadi
      return { value: hit.value, cache: "stale", ageMs: age };
    }
  }
  const value = await refresh();
  return { value, cache: "miss", ageMs: 0 };
}

export function invalidate(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
