/** .env dagi ADMIN_TELEGRAM_IDS="123,456" ro'yxati — adminlarning yagona manbasi. */
export function envAdminIds(): Set<string> {
  return new Set((process.env.ADMIN_TELEGRAM_IDS ?? "").split(/[,\s;]+/).map(s => s.trim()).filter(Boolean));
}
export const isEnvAdmin = (telegramId: string | number) => envAdminIds().has(String(telegramId));
