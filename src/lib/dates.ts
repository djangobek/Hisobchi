export function monthBounds(year: number, monthIndex: number) {
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}
export function localDateKey(date: Date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,"0"), d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
export const monthLabel = (date: Date, lang: "uz" | "ru" = "uz") => {
  const label = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "uz-UZ", { month: "long", year: "numeric" }).format(date);
  return lang === "ru" ? label.charAt(0).toUpperCase() + label.slice(1) : label;
};
