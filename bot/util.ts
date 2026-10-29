import type { Lang } from "../src/lib/i18n";

/** Yangi matnlar uchun qisqa ikki tilli yordamchi: L(lang, "uzbekcha", "русский"). */
export const L = (lang: Lang, uz: string, ru: string) => (lang === "ru" ? ru : uz);

export const htmlEscape = (value: string) =>
  value.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export const TZ = "Asia/Tashkent";
/** O'zbekiston DST'siz, doim UTC+5. */
const TZ_OFFSET = "+05:00";

/** Toshkent bo'yicha bugungi sana: YYYY-MM-DD. */
export const todayTashkent = (now = new Date()) => now.toLocaleDateString("sv-SE", { timeZone: TZ });

/** YYYY-MM-DD ning Toshkent bo'yicha 00:00 vaqti. */
export const startOfDay = (ymd: string) => new Date(`${ymd}T00:00:00${TZ_OFFSET}`);

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00${TZ_OFFSET}`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("sv-SE", { timeZone: TZ });
}

/** Joriy oy chegaralari (Toshkent bo'yicha): [start, end). */
export function monthRangeTashkent(now = new Date()) {
  const [y, m] = todayTashkent(now).split("-").map(Number);
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };
  const p = (n: number) => String(n).padStart(2, "0");
  return { start: startOfDay(`${y}-${p(m)}-01`), end: startOfDay(`${next.y}-${p(next.m)}-01`), year: y, month: m };
}

export const fmtDate = (d: Date | string, lang: Lang, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }) =>
  new Date(d).toLocaleDateString(lang === "ru" ? "ru-RU" : "uz-UZ", { ...opts, timeZone: TZ });

/** Matnli progress-bar: ▓▓▓░░░░░ */
export function bar(value: number, max: number, width = 10): string {
  if (max <= 0) return "░".repeat(width);
  const filled = Math.max(value > 0 ? 1 : 0, Math.min(width, Math.round((value / max) * width)));
  return "▓".repeat(filled) + "░".repeat(width - filled);
}

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Ism solishtirish uchun: kichik harf, apostrof/bo'shliq tozalanadi, kirill → lotin (taxminiy). */
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "s", ч: "c", ш: "s", щ: "s", ы: "i", э: "e", ю: "u", я: "a", ў: "u", қ: "q", ғ: "g", ҳ: "h", ь: "", ъ: "",
};
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "")
    .replace(/[а-яёўқғҳ]/g, c => CYR[c] ?? c)
    .replace(/(ning|dan|ga|ni|ka|qa)$/, "")
    .replace(/[^a-z0-9]/g, "");
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Ikki ism bir shaxsga tegishlimi (Alisher ~ Alisherga ~ Алишер ~ Alishr). */
export function sameName(a: string, b: string): boolean {
  const x = nameKey(a), y = nameKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  if (Math.min(x.length, y.length) >= 4 && (x.startsWith(y) || y.startsWith(x))) return true;
  return levenshtein(x, y) <= (Math.max(x.length, y.length) >= 7 ? 2 : 1);
}
