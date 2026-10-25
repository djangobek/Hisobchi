import { formatMoney, type Lang } from "./i18n";
export function formatUZS(value: number | string | { toString(): string }, lang: Lang = "uz"): string {
  return formatMoney(Number(value), lang);
}
export function parseAmount(value: string): number {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Summa noldan katta bo‘lishi kerak.");
  return amount;
}
