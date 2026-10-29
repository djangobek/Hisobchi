/**
 * Ovozli va matnli kiritish: STT → NLU → tekshiruv (draft) → tasdiqlash → bazaga saqlash.
 * Draft'da har bir yozuvni alohida o'chirish mumkin; faqat tasdiqlangandan keyin saqlanadi.
 */
import { Bot, InlineKeyboard, type Context } from "grammy";
import { randomUUID } from "node:crypto";
import { formatMoney, type Lang } from "../src/lib/i18n";
import { extractAmounts } from "../src/lib/voice-parser";
import { type CatInfo } from "../src/lib/category-match";
import { CFG } from "./config";
import { langOf, rateLimited, requireUser, openKeyboard } from "./ctx";
import { extractOperations, TooManyOpsError, type DraftOp } from "./nlu";
import { budgetStatus, commitOperations, loadContext, planOperations, type PlannedOp } from "./store";
import { sttConfigured, transcribe } from "./stt";
import { tx } from "./texts";
import { L, bar, fmtDate, htmlEscape } from "./util";

type Draft = { token: string; telegramId: string; userId: string; ops: DraftOp[]; transcript: string; createdAt: number; source: string; cats: CatInfo[] };
const drafts = new Map<string, Draft>();
const saving = new Set<string>();

/** Tanlash menyusi uchun bir xil tartibdagi kategoriyalar (indeks callback ichida ketadi). */
const catsFor = (d: Draft, kind: DraftOp["kind"]) => d.cats.filter(c => c.type === kind).sort((a, b) => a.name.localeCompare(b.name));
const isTx = (op: { kind: string }) => op.kind === "INCOME" || op.kind === "EXPENSE";

function gc() { const now = Date.now(); for (const [k, v] of drafts) if (now - v.createdAt > CFG.draftTtlMs) drafts.delete(k); }

/* ---------------- Ko'rinish ---------------- */

function describe(op: PlannedOp, lang: Lang): string {
  const money = `<b>${formatMoney(op.amount, lang)}</b>`;
  const date = fmtDate(`${op.date}T12:00:00+05:00`, lang);
  const note = op.note ? `\n   📝 ${htmlEscape(op.note)}` : "";
  const fb = op.catFallback ? ` ❓ <i>${L(lang, "mos kategoriya topilmadi", "подходящая категория не найдена")}</i>` : "";
  const warn = op.warn === "amount" ? `\n   ⚠️ ${L(lang, "Summani tekshiring", "Проверьте сумму")}` : "";
  const person = htmlEscape(op.person ?? "");
  switch (op.kind) {
    case "EXPENSE": return `🔴 ${L(lang, "Xarajat", "Расход")}: ${money}\n   🏷 ${htmlEscape(op.category)}${fb} · ${date}${note}${warn}`;
    case "INCOME": return `🟢 ${L(lang, "Daromad", "Доход")}: ${money}\n   🏷 ${htmlEscape(op.category)}${fb} · ${date}${note}${warn}`;
    case "DEBT_BORROWED": return `📥 ${L(lang, "Qarz olindi", "Взят в долг")}: ${money}\n   👤 ${person} · ${date}${op.dueDate ? `\n   ⏳ ${L(lang, "Muddat", "Срок")}: ${fmtDate(`${op.dueDate}T12:00:00+05:00`, lang)}` : ""}${warn}`;
    case "DEBT_LENT": return `📤 ${L(lang, "Qarz berildi", "Дан в долг")}: ${money}\n   👤 ${person} · ${date}${op.dueDate ? `\n   ⏳ ${L(lang, "Muddat", "Срок")}: ${fmtDate(`${op.dueDate}T12:00:00+05:00`, lang)}` : ""}${warn}`;
    default: {
      const head = op.kind === "REPAY_IN" ? `✅ ${L(lang, "Qarz qaytarildi (sizga)", "Вам вернули долг")}` : `💸 ${L(lang, "Qarz to‘landi (siz)", "Вы вернули долг")}`;
      if (op.problem === "nodebt") return `⚠️ ${head}: ${money}\n   👤 ${person}\n   ❗ ${L(lang, "Bu shaxs bo‘yicha ochiq qarz topilmadi — saqlanmaydi.", "Открытый долг по этому человеку не найден — запись не будет сохранена.")}`;
      if (op.problem === "ambiguous") return `⚠️ ${head}: ${money}\n   👤 ${person}\n   ❗ ${L(lang, "Bir nechta o‘xshash ism bor — ismni aniqroq ayting.", "Найдено несколько похожих имён — уточните имя.")}`;
      const after = op.allocations?.reduce((s, a) => s + a.remainingAfter, 0) ?? 0;
      const applied = op.allocations?.reduce((s, a) => s + a.apply, 0) ?? op.amount;
      const cap = op.capped ? `\n   ⚠️ ${L(lang, `Qarzdan ${formatMoney(op.capped, lang)} ortiq — faqat ${formatMoney(applied, lang)} hisobga olinadi.`, `Сверх долга ${formatMoney(op.capped, lang)} — будет учтено только ${formatMoney(applied, lang)}.`)}` : "";
      return `${head}: ${money}\n   👤 ${person} · ${date}\n   📉 ${L(lang, "Qoldiq", "Остаток")}: <b>${formatMoney(after, lang)}</b>${cap}`;
    }
  }
}

function formatDraft(planned: PlannedOp[], draft: Draft, lang: Lang, saved?: { skipped: number }): string {
  const ok = planned.filter(p => !p.problem);
  const sum = (kinds: string[]) => ok.filter(p => kinds.includes(p.kind)).reduce((a, p) => a + p.amount, 0);
  const lines = planned.map((p, i) => `<b>${i + 1}.</b> ${describe(p, lang)}`);
  const totals: string[] = [];
  if (ok.some(p => p.kind === "INCOME")) totals.push(`🟢 ${L(lang, "Jami daromad", "Итого доходы")}: <b>${formatMoney(sum(["INCOME"]), lang)}</b>`);
  if (ok.some(p => p.kind === "EXPENSE")) totals.push(`🔴 ${L(lang, "Jami xarajat", "Итого расходы")}: <b>${formatMoney(sum(["EXPENSE"]), lang)}</b>`);
  if (ok.some(p => p.kind === "DEBT_BORROWED")) totals.push(`📥 ${L(lang, "Olingan qarz", "Взято в долг")}: <b>${formatMoney(sum(["DEBT_BORROWED"]), lang)}</b>`);
  if (ok.some(p => p.kind === "DEBT_LENT")) totals.push(`📤 ${L(lang, "Berilgan qarz", "Выдано в долг")}: <b>${formatMoney(sum(["DEBT_LENT"]), lang)}</b>`);
  const title = saved
    ? `✅ <b>${L(lang, `${ok.length} ta yozuv saqlandi`, `Сохранено записей: ${ok.length}`)}</b>`
    : `🎙 <b>${L(lang, "Aniqlangan yozuvlarni tekshiring", "Проверьте распознанные записи")}</b>`;
  const skipped = saved?.skipped ? `\n\n⚠️ ${L(lang, `${saved.skipped} ta yozuv saqlanmadi.`, `Не сохранено записей: ${saved.skipped}.`)}` : "";
  const hint = saved ? "" : `\n\n👇 ${L(lang, "Noto‘g‘ri yozuvni 🗑 bilan olib tashlang. Faqat tasdiqlangandan keyin saqlanadi.", "Лишнюю запись уберите кнопкой 🗑. Сохранение — только после подтверждения.")}`;
  return `${title}\n\n📝 <i>${htmlEscape(draft.transcript)}</i>\n\n${lines.join("\n\n")}${totals.length ? `\n\n${totals.join("\n")}` : ""}${skipped}${hint}`;
}

function keyboard(planned: PlannedOp[], token: string, lang: Lang) {
  const kb = new InlineKeyboard();
  if (planned.length > 1) {
    planned.forEach((_, i) => { kb.text(`🗑 ${i + 1}`, `voice:rm:${token}:${i}`); if ((i + 1) % 5 === 0) kb.row(); });
    kb.row();
  }
  // Kategoriyani o'zgartirish: faqat daromad/xarajat yozuvlari uchun
  const txIdx = planned.map((p, i) => (isTx(p) ? i : -1)).filter(i => i >= 0);
  if (txIdx.length) {
    txIdx.forEach((i, n) => { kb.text(planned.length > 1 ? `🏷 ${i + 1}` : L(lang, "🏷 Kategoriyani o‘zgartirish", "🏷 Сменить категорию"), `voice:cm:${token}:${i}`); if ((n + 1) % 5 === 0) kb.row(); });
    kb.row();
  }
  const canSave = planned.some(p => !p.problem);
  if (canSave) kb.text(L(lang, "✅ Saqlash", "✅ Сохранить"), `voice:ok:${token}`);
  kb.text(L(lang, "❌ Bekor qilish", "❌ Отмена"), `voice:cancel:${token}`);
  return kb;
}

/* ---------------- Draft yaratish ---------------- */

async function createDraft(ctx: Context, userId: string, lang: Lang, transcript: string, source: string, editMsgId: number): Promise<void> {
  const chatId = ctx.chat!.id;
  const edit = (text: string, extra: Record<string, unknown> = {}) => ctx.api.editMessageText(chatId, editMsgId, text, extra as any).catch(() => {});
  try {
    const nluCtx = await loadContext(userId);
    const nlu = await extractOperations(transcript, nluCtx);
    console.log(`[VOICE] src=${source} nlu=${nlu.engine} ops=${nlu.ops.length} uncertain=${nlu.uncertain}`);
    if (!nlu.ops.length) {
      const heard = `\n\n📝 <i>${htmlEscape(transcript)}</i>`;
      return void await edit((nlu.uncertain ? tx(lang, "voiceUnclear") : tx(lang, "voiceNoOperations")) + heard, { parse_mode: "HTML" });
    }
    const draft: Draft = { token: randomUUID().replace(/-/g, "").slice(0, 20), telegramId: String(ctx.from!.id), userId, ops: nlu.ops, transcript, createdAt: Date.now(), source, cats: nluCtx.categories };
    gc(); drafts.set(draft.token, draft);
    const planned = await planOperations(userId, draft.ops);
    const extra = nlu.uncertain ? `\n\n⚠️ ${L(lang, `${nlu.uncertain} ta noaniq operatsiya o‘tkazib yuborildi. Ularni alohida ayting.`, `Неясных операций пропущено: ${nlu.uncertain}. Продиктуйте их отдельно.`)}` : "";
    await edit(formatDraft(planned, draft, lang) + extra, { parse_mode: "HTML", reply_markup: keyboard(planned, draft.token, lang) });
  } catch (e) {
    if (e instanceof TooManyOpsError) return void await edit(L(lang, `Bir xabarda ${CFG.maxOpsPerMessage} tadan ortiq operatsiya bo‘lishi mumkin emas. Iltimos, qismlarga bo‘ling.`, `В одном сообщении не может быть больше ${CFG.maxOpsPerMessage} операций. Разбейте на части.`));
    console.error("[VOICE] Draft yaratishda xato:", e instanceof Error ? e.message : e);
    await edit(tx(lang, "voiceRetry"));
  }
}

/** Matnni ovozdagi kabi tahlil qiladi (oddiy xabar va /add <matn> uchun umumiy). */
export async function handleTextInput(ctx: Context, text: string): Promise<void> {
  const lang = await langOf(ctx);
  if (extractAmounts(text).length === 0) return void await ctx.reply(tx(lang, "unknown"), { reply_markup: openKeyboard(lang) });
  const gate = await requireUser(ctx); if (!gate) return;
  if (rateLimited(`u:${gate.user.id}`)) return void await ctx.reply(L(lang, "⏳ Juda tez-tez so‘rov yuboryapsiz. Bir daqiqadan so‘ng urinib ko‘ring.", "⏳ Слишком много запросов. Попробуйте через минуту."));
  if (text.length > 1000) return void await ctx.reply(L(lang, "Matn juda uzun (1000 belgigacha).", "Слишком длинный текст (до 1000 символов)."));
  const status = await ctx.reply(tx(gate.lang, "voiceAnalyzing"));
  await createDraft(ctx, gate.user.id, gate.lang, text, "text", status.message_id);
}

/* ---------------- Ro'yxatdan o'tkazish ---------------- */

export function registerVoice(bot: Bot) {
  const token = process.env.BOT_TOKEN!;

  bot.on(["message:voice", "message:audio"], async ctx => {
    const gate = await requireUser(ctx); if (!gate) return;
    const { user, lang } = gate;
    const media = ctx.message.voice ?? ctx.message.audio; if (!media) return;
    if (media.duration > CFG.voiceMaxSeconds) return void ctx.reply(L(lang, `⏱ Ovozli xabar ${CFG.voiceMaxSeconds} soniyadan oshmasligi kerak. Qisqaroq qilib qayta yuboring.`, `⏱ Голосовое сообщение должно быть не длиннее ${CFG.voiceMaxSeconds} секунд. Отправьте покороче.`));
    if (!sttConfigured()) return void ctx.reply(tx(lang, "voiceNotConfigured"));
    if (rateLimited(`u:${user.id}`)) return void ctx.reply(L(lang, "⏳ Juda tez-tez so‘rov yuboryapsiz. Bir daqiqadan so‘ng urinib ko‘ring.", "⏳ Слишком много запросов. Попробуйте через минуту."));

    const status = await ctx.reply(L(lang, "🎧 <b>1/3.</b> Ovoz yuklanmoqda…", "🎧 <b>1/3.</b> Загружаем аудио…"), { parse_mode: "HTML" });
    const progress = (text: string) => ctx.api.editMessageText(ctx.chat.id, status.message_id, text, { parse_mode: "HTML" }).catch(() => {});
    try {
      const file = await ctx.api.getFile(media.file_id);
      if (!file.file_path) throw new Error("Telegram audio fayl manzili yo'q");
      const dl = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`, { signal: AbortSignal.timeout(20_000) });
      if (!dl.ok) throw new Error(`Telegram audio HTTP ${dl.status}`);
      const audio = Buffer.from(await dl.arrayBuffer());
      if (audio.length > CFG.voiceMaxBytes) throw new Error("Audio fayl hajmi limitdan katta");

      await progress(`<b>2/3.</b> ${tx(lang, "voiceTranscribing")}`);
      const stt = await transcribe(audio, file.file_path.split("/").pop() || "voice.ogg", media.mime_type || "audio/ogg", lang);
      console.log(`[VOICE] STT=${stt.provider} belgilar=${stt.text.length}`);

      await progress(`<b>3/3.</b> ${tx(lang, "voiceAnalyzing")}`);
      await createDraft(ctx, user.id, lang, stt.text, `voice:${stt.provider}`, status.message_id);
    } catch (e) {
      console.error("[VOICE] Ovoz tahlili muvaffaqiyatsiz:", e instanceof Error ? e.message : e);
      await progress(tx(lang, "voiceRetry"));
    }
  });

  /** Oddiy matn: "ovqatga 25 ming", "Alisherdan 500 ming qarz oldim" — ovozdagi kabi tahlil qilinadi. */
  bot.on("message:text", async ctx => {
    const text = ctx.message.text.trim();
    if (text.startsWith("/")) return;
    await handleTextInput(ctx, text);
  });

  /** Kategoriya menyusi: 🏷 → ro'yxat → tanlash → draft yangilanadi. Saqlanmaguncha bazaga tegmaydi. */
  bot.callbackQuery(/^voice:(cm|cs|back):([a-f0-9]+)(?::(\d+))?(?::(\d+))?$/, async ctx => {
    const [, action, tokenId, iRaw, jRaw] = ctx.match;
    const lang = await langOf(ctx);
    const draft = drafts.get(tokenId);
    if (!draft || draft.telegramId !== String(ctx.from.id) || Date.now() - draft.createdAt > CFG.draftTtlMs) {
      drafts.delete(tokenId);
      return void ctx.answerCallbackQuery({ text: tx(lang, "voiceExpired"), show_alert: true });
    }
    const render = async () => {
      const planned = await planOperations(draft.userId, draft.ops);
      await ctx.editMessageText(formatDraft(planned, draft, lang), { parse_mode: "HTML", reply_markup: keyboard(planned, tokenId, lang) }).catch(() => {});
    };
    if (action === "back") { await ctx.answerCallbackQuery(); return void await render(); }

    const i = Number(iRaw);
    const op = draft.ops[i];
    if (!op || !isTx(op)) return void ctx.answerCallbackQuery();
    const list = catsFor(draft, op.kind);

    if (action === "cm") {
      const kb = new InlineKeyboard();
      list.slice(0, 60).forEach((c, j) => { kb.text(`${c.name === op.category ? "✅ " : ""}${c.name}`.slice(0, 40), `voice:cs:${tokenId}:${i}:${j}`); if ((j + 1) % 2 === 0) kb.row(); });
      kb.row().text(L(lang, "⬅️ Orqaga", "⬅️ Назад"), `voice:back:${tokenId}`);
      await ctx.answerCallbackQuery();
      const head = `🏷 <b>${L(lang, `${i + 1}-yozuv uchun kategoriya tanlang`, `Выберите категорию для записи ${i + 1}`)}</b>\n<i>${htmlEscape(op.note)}</i>`;
      return void await ctx.editMessageText(head, { parse_mode: "HTML", reply_markup: kb }).catch(() => {});
    }

    const chosen = list[Number(jRaw)];
    if (!chosen) return void ctx.answerCallbackQuery();
    op.category = chosen.name; op.catFallback = undefined;
    await ctx.answerCallbackQuery({ text: `🏷 ${chosen.name}` });
    await render();
  });

  bot.callbackQuery(/^voice:(ok|cancel|rm):([a-f0-9]+)(?::(\d+))?$/, async ctx => {
    const [, action, tokenId, idxRaw] = ctx.match;
    const lang = await langOf(ctx);
    const draft = drafts.get(tokenId);
    if (!draft || draft.telegramId !== String(ctx.from.id) || Date.now() - draft.createdAt > CFG.draftTtlMs) {
      drafts.delete(tokenId);
      return void ctx.answerCallbackQuery({ text: tx(lang, "voiceExpired"), show_alert: true });
    }

    if (action === "cancel") {
      drafts.delete(tokenId);
      await ctx.answerCallbackQuery({ text: L(lang, "Bekor qilindi", "Отменено") });
      return void ctx.editMessageText(tx(lang, "voiceCancelled")).catch(() => {});
    }

    if (action === "rm") {
      const idx = Number(idxRaw);
      if (!Number.isInteger(idx) || idx < 0 || idx >= draft.ops.length) return void ctx.answerCallbackQuery();
      draft.ops.splice(idx, 1);
      if (!draft.ops.length) { drafts.delete(tokenId); await ctx.answerCallbackQuery(); return void ctx.editMessageText(tx(lang, "voiceCancelled")).catch(() => {}); }
      const planned = await planOperations(draft.userId, draft.ops);
      await ctx.answerCallbackQuery({ text: L(lang, "Olib tashlandi", "Убрано") });
      return void ctx.editMessageText(formatDraft(planned, draft, lang), { parse_mode: "HTML", reply_markup: keyboard(planned, tokenId, lang) }).catch(() => {});
    }

    // ok — saqlash. Xotiradagi qulf ikki marta bosishdan himoya qiladi; tranzaksiyalar uchun DB'da requestKey ham bor.
    if (saving.has(tokenId)) return void ctx.answerCallbackQuery({ text: tx(lang, "voiceSaving") });
    saving.add(tokenId);
    try {
      const result = await commitOperations(draft.userId, tokenId, draft.ops);
      drafts.delete(tokenId);
      await ctx.answerCallbackQuery({ text: L(lang, `${result.saved} ta yozuv saqlandi`, `Сохранено: ${result.saved}`) }).catch(() => {});
      // DB commit tugagan: Telegram UI xatolari saqlashni "muvaffaqiyatsiz" qilib ko'rsatmasligi kerak.
      const summary = savedSummary(result, draft, lang);
      await ctx.editMessageText(summary, { parse_mode: "HTML", reply_markup: openKeyboard(lang) }).catch(() => {});
      if (result.txCount) {
        const b = await budgetStatus(draft.userId).catch(() => null);
        if (b && b.ratio >= 0.8) {
          const pct = Math.round(b.ratio * 100);
          const msg = b.ratio >= 1
            ? L(lang, `🚨 <b>Oylik byudjet oshdi!</b>\n${bar(b.spent, b.budget)} ${pct}%\nSarflandi: ${formatMoney(b.spent, lang)} / ${formatMoney(b.budget, lang)}`, `🚨 <b>Месячный бюджет превышен!</b>\n${bar(b.spent, b.budget)} ${pct}%\nПотрачено: ${formatMoney(b.spent, lang)} / ${formatMoney(b.budget, lang)}`)
            : L(lang, `⚠️ <b>Byudjetning ${pct}% ishlatildi</b>\n${bar(b.spent, b.budget)}\nQolgan: ${formatMoney(b.budget - b.spent, lang)}`, `⚠️ <b>Использовано ${pct}% бюджета</b>\n${bar(b.spent, b.budget)}\nОсталось: ${formatMoney(b.budget - b.spent, lang)}`);
          await ctx.reply(msg, { parse_mode: "HTML" }).catch(() => {});
        }
      }
    } catch (e) {
      console.error("[VOICE] Saqlash muvaffaqiyatsiz:", e instanceof Error ? e.message : e);
      await ctx.answerCallbackQuery({ text: tx(lang, "voiceSaveFailed"), show_alert: true }).catch(() => {});
    } finally { saving.delete(tokenId); }
  });
}

function savedSummary(r: { saved: number; skipped: number; txCount: number; debtCount: number; repayCount: number }, d: Draft, lang: Lang): string {
  const parts: string[] = [];
  if (r.txCount) parts.push(L(lang, `💸 Daromad/xarajat: ${r.txCount} ta`, `💸 Доходы/расходы: ${r.txCount}`));
  if (r.debtCount) parts.push(L(lang, `💳 Yangi qarz: ${r.debtCount} ta`, `💳 Новых долгов: ${r.debtCount}`));
  if (r.repayCount) parts.push(L(lang, `✅ Qarz to‘lovi: ${r.repayCount} ta`, `✅ Платежей по долгам: ${r.repayCount}`));
  const skipped = r.skipped ? `\n⚠️ ${L(lang, `Saqlanmadi: ${r.skipped} ta (mos qarz topilmadi)`, `Не сохранено: ${r.skipped} (долг не найден)`)}` : "";
  return `✅ <b>${L(lang, `${r.saved} ta yozuv muvaffaqiyatli saqlandi`, `Успешно сохранено записей: ${r.saved}`)}</b>\n\n${parts.join("\n")}${skipped}\n\n📝 <i>${htmlEscape(d.transcript)}</i>`;
}

