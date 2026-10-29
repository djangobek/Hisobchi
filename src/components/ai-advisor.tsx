"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n-client";
import { localeOf, type Lang } from "@/lib/i18n";
import { ArrowLeft, ArrowUp, Mic, Plus, X, Sparkles, Trash2, ShieldCheck, Target, Save, Loader2, MessageCircle, Brain, Copy, Check, BarChart3, HandCoins, HeartPulse, AlertTriangle, SlidersHorizontal, Wallet, Share2 } from "lucide-react";

type Message = { id?: string; role: "user" | "assistant"; content: string; provider?: string | null; createdAt?: string };
type Memory = { enabled: boolean; content: string; updatedAt?: string };
type Goal = { id: string; title: string; targetAmount: number; currentAmount: number; targetDate: string | null };
type Insight = { id: string; tone: "good" | "warn" | "info"; title: string; text: string };
type Tab = "chat" | "stats" | "debts" | "goals" | "memory";
type DebtRow = { person: string; direction: "LENT" | "BORROWED"; original: number; paid: number; remaining: number; due: string | null; overdue: boolean };
type Analytics = {
  score: { value: number; label: string; parts: { label: string; points: number; max: number; hint: string }[] } | null;
  safeDaily: { perDay: number; remaining: number; daysLeft: number; avgDaily: number; baseIncome: number; status: "ok" | "tight" | "over" } | null;
  anomalies: { id: string; title: string; text: string }[];
  debts: { rows: DebtRow[]; receivable: number; payable: number; receivablePaid: number; payablePaid: number; overdue: number };
  whatIf: { avgIncome: number; avgExpense: number };
};
const fmtN = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function reminderText(d: DebtRow, lang: Lang) {
  if (lang === "ru") {
    const due = d.due ? ` (срок: ${d.due})` : "";
    return d.paid > 0
      ? `Здравствуйте, ${d.person}! Из долга ${fmtN(d.original)} сум возвращено ${fmtN(d.paid)} сум, остаётся ${fmtN(d.remaining)} сум${due}. Буду очень признателен, если вернёте в удобное время. Спасибо!`
      : `Здравствуйте, ${d.person}! Хотел напомнить о долге ${fmtN(d.remaining)} сум${due}. Буду признателен, если вернёте в удобное время. Спасибо!`;
  }
  const due = d.due ? ` (muddat: ${d.due})` : "";
  return d.paid > 0
    ? `Assalomu alaykum, ${d.person}! ${fmtN(d.original)} so'mlik qarzdan ${fmtN(d.paid)} so'mi qaytgan, ${fmtN(d.remaining)} so'm qolgan${due}. Qulay vaqtda qaytarib bersangiz, juda minnatdor bo'laman. Rahmat!`
    : `Assalomu alaykum, ${d.person}! ${fmtN(d.remaining)} so'mlik qarz haqida eslatib o'tmoqchi edim${due}. Qulay vaqtda qaytarib bersangiz, minnatdor bo'laman. Rahmat!`;
}

function ScoreRing({ value }: { value: number }) {
  const { t: tr } = useI18n();
  const r = 38, c = 2 * Math.PI * r, color = value >= 80 ? "#22c55e" : value >= 60 ? "#60a5fa" : value >= 40 ? "#f59e0b" : "#ef4444";
  return <svg viewBox="0 0 100 100" width="104" height="104" aria-label={`${tr("Sog'liq bali")}: ${value}`}><circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.09)" strokeWidth="9"/><circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * value / 100} ${c}`} transform="rotate(-90 50 50)"/><text x="50" y="55" textAnchor="middle" fontSize="26" fontWeight="800" fill="currentColor">{value}</text></svg>;
}

// Tezkor savollar: har biri qisqa, AI ham qisqa javob beradi (token tejash).
type Bi = { uz: string; ru: string };
const CHIPS: { label: Bi; emoji: string; prompt: Bi }[] = [
  { emoji: "📊", label: { uz: "Xarajat tahlili", ru: "Анализ расходов" }, prompt: { uz: "Bu oy pulim qayerga ketdi? Eng katta 3 ta xarajat va nima qilish mumkin.", ru: "Куда ушли мои деньги в этом месяце? Три самых крупных расхода и что можно сделать." } },
  { emoji: "✂️", label: { uz: "Ortiqcha xarajat", ru: "Лишние расходы" }, prompt: { uz: "Qaysi xarajatlarimni zarur ehtiyojni buzmasdan kamaytirsam bo'ladi?", ru: "Какие расходы можно сократить, не ущемляя необходимые потребности?" } },
  { emoji: "🎯", label: { uz: "Tejash rejasi", ru: "План накоплений" }, prompt: { uz: "Keyingi oy uchun oddiy va real tejash rejasi tuz.", ru: "Составь простой и реалистичный план накоплений на следующий месяц." } },
  { emoji: "📅", label: { uz: "Kunlik limit", ru: "Дневной лимит" }, prompt: { uz: "Oy oxirigacha kuniga qancha sarflashim mumkin?", ru: "Сколько я могу тратить в день до конца месяца?" } },
  { emoji: "🔮", label: { uz: "Prognoz", ru: "Прогноз" }, prompt: { uz: "Shu sur'atda oy oxirida holatim qanday bo'ladi?", ru: "Каким будет моё положение в конце месяца при таком темпе?" } },
  { emoji: "🤝", label: { uz: "Qarzlarim", ru: "Мои долги" }, prompt: { uz: "Qarzlarim holati: kim qancha bergan/olgan, qancha qaytgan, qancha qoldi — ismlar bilan. Muddati o'tganlarni birinchi ayt.", ru: "Состояние моих долгов: кто сколько дал/взял, сколько вернули, сколько осталось — с именами. Сначала назови просроченные." } },
  { emoji: "🧾", label: { uz: "Qarzni yopish rejasi", ru: "План закрытия долгов" }, prompt: { uz: "Qarzlarimni yopish uchun qadamma-qadam reja tuz. Qaysi birini birinchi yopay?", ru: "Составь пошаговый план закрытия моих долгов. Какой закрыть первым?" } },
  { emoji: "✉️", label: { uz: "Qarz eslatma xabari", ru: "Напоминание о долге" }, prompt: { uz: "Menga qarzdor odamga yuborish uchun muloyim, qisqa eslatma xabari yoz (o'zbek tilida).", ru: "Напиши вежливое короткое сообщение-напоминание для человека, который мне должен (на русском языке)." } },
  { emoji: "⚖️", label: { uz: "50/30/20 tekshiruvi", ru: "Проверка 50/30/20" }, prompt: { uz: "Xarajatlarimni 50/30/20 qoidasi bilan solishtir: ehtiyoj, xohish, jamg'arma.", ru: "Сравни мои расходы с правилом 50/30/20: потребности, желания, сбережения." } },
  { emoji: "💯", label: { uz: "Moliyaviy ball", ru: "Финансовый балл" }, prompt: { uz: "Moliyaviy holatimga 100 ballik baho ber va ballni oshirishning 3 yo'lini ayt.", ru: "Оцени моё финансовое положение по 100-балльной шкале и назови 3 способа повысить балл." } },
  { emoji: "📝", label: { uz: "Hisobot", ru: "Отчёт" }, prompt: { uz: "Oxirgi 7 kun va joriy oy bo'yicha qisqa hisobot ber.", ru: "Дай краткий отчёт за последние 7 дней и текущий месяц." } },
];

function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>);
}

// Kichik, xavfsiz markdown ko'rsatkich (**qalin**, "- " va "1." ro'yxatlar, sarlavhalar) — tashqi kutubxonasiz.
function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={`l${blocks.length}`} className="ai-list">{list.items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^\|?[\s:-]+\|[\s|:-]*$/.test(line)) continue; // jadval ajratgichi
    const bullet = line.match(/^[-*•]\s+(.*)/); const num = line.match(/^\d+[.)]\s+(.*)/); const head = line.match(/^#{1,4}\s+(.*)/);
    if (bullet) { if (!list || list.ordered) { flush(); list = { ordered: false, items: [] }; } list.items.push(bullet[1]); }
    else if (num) { if (!list || !list.ordered) { flush(); list = { ordered: true, items: [] }; } list.items.push(num[1]); }
    else { flush(); blocks.push(head ? <div key={`h${blocks.length}`} className="ai-heading">{renderInline(head[1])}</div> : <p key={`p${blocks.length}`} className="ai-para">{renderInline(line)}</p>); }
  }
  flush();
  return <>{blocks}</>;
}

/** Robot-yordamchi: SVG, holatga qarab ko'z qisadi / "o'ylaydi". Tashqi rasm kerak emas, har qanday o'lchamda aniq. */
export function AiBot({ size = 120, state = "idle" }: { size?: number; state?: "idle" | "thinking" }) {
  const id = useRef(`b${Math.random().toString(36).slice(2, 8)}`).current;
  return <svg className={`aiv-bot ${state}`} viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Hisobchi AI">
    <defs>
      <radialGradient id={`${id}s`} cx="38%" cy="28%" r="80%"><stop offset="0" stopColor="#ffffff"/><stop offset=".62" stopColor="#e6ebf7"/><stop offset="1" stopColor="#b9c4e0"/></radialGradient>
      <linearGradient id={`${id}v`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#141a3d"/><stop offset="1" stopColor="#04061a"/></linearGradient>
      <radialGradient id={`${id}e`}><stop offset="0" stopColor="#fff"/><stop offset=".55" stopColor="#bfdbfe"/><stop offset="1" stopColor="#60a5fa"/></radialGradient>
      <filter id={`${id}g`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.2"/></filter>
    </defs>
    <ellipse cx="100" cy="186" rx="52" ry="7" fill="#3b82f6" opacity=".22" className="aiv-bot-shadow"/>
    <g className="aiv-bot-body">
      <path d="M38 104 C38 40 70 18 100 18 C130 18 162 40 162 104" fill="none" stroke={`url(#${id}s)`} strokeWidth="9" strokeLinecap="round"/>
      <rect x="22" y="84" width="24" height="50" rx="12" fill={`url(#${id}s)`}/><rect x="40" y="92" width="7" height="34" rx="3.5" fill="#0b0f2a"/>
      <rect x="154" y="84" width="24" height="50" rx="12" fill={`url(#${id}s)`}/><rect x="153" y="92" width="7" height="34" rx="3.5" fill="#0b0f2a"/>
      <path d="M170 128 C170 150 160 158 140 160" fill="none" stroke="#2a3158" strokeWidth="4" strokeLinecap="round"/><rect x="124" y="156" width="20" height="9" rx="4.5" fill="#0b0f2a"/>
      <ellipse cx="100" cy="100" rx="62" ry="56" fill={`url(#${id}s)`}/>
      <rect x="50" y="68" width="100" height="62" rx="30" fill={`url(#${id}v)`}/>
      <path d="M62 78 Q100 66 138 78" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth="3" strokeLinecap="round"/>
      <g className="aiv-eyes">
        <g filter={`url(#${id}g)`} opacity=".9"><circle cx="78" cy="98" r="9" fill="#60a5fa"/><circle cx="122" cy="98" r="9" fill="#60a5fa"/></g>
        <circle className="aiv-eye" cx="78" cy="98" r="8" fill={`url(#${id}e)`}/><circle className="aiv-eye" cx="122" cy="98" r="8" fill={`url(#${id}e)`}/>
      </g>
      <path className="aiv-smile" d="M90 113 Q100 121 110 113" fill="none" stroke="#bfdbfe" strokeWidth="3.4" strokeLinecap="round"/>
      <g className="aiv-dots"><circle cx="88" cy="115" r="2.6" fill="#bfdbfe"/><circle cx="100" cy="115" r="2.6" fill="#bfdbfe"/><circle cx="112" cy="115" r="2.6" fill="#bfdbfe"/></g>
    </g>
  </svg>;
}

type SR = { start: () => void; stop: () => void; lang: string; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type TgWebApp = {
  initDataUnsafe?: { user?: { first_name?: string } };
  expand?: () => void; ready?: () => void; disableVerticalSwipes?: () => void; enableVerticalSwipes?: () => void;
  requestFullscreen?: () => void; exitFullscreen?: () => void; isFullscreen?: boolean; isVersionAtLeast?: (v: string) => boolean;
  setHeaderColor?: (c: string) => void; setBackgroundColor?: (c: string) => void; setBottomBarColor?: (c: string) => void;
  BackButton?: { show: () => void; hide: () => void; onClick: (f: () => void) => void; offClick: (f: () => void) => void };
  HapticFeedback?: { impactOccurred?: (s: string) => void };
};
const tgApp = () => (window as Window & { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
/** Telegram'da ham to'liq ekran (Bot API 8.0+). Kerak bo'lmasa false qiling — baribir butun ekranni egallaydi, faqat Telegram sarlavhasi qoladi. */
const TG_FULLSCREEN = true;

function initData() { return (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? ""; }

export default function AiAdvisor({ onClose }: { onClose?: () => void }) {
  const { t: tr, lang } = useI18n();
  const nf = (n: number) => new Intl.NumberFormat(localeOf(lang)).format(n);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState("");
  const [memory, setMemory] = useState<Memory>({ enabled: false, content: "" });
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [savingGoal, setSavingGoal] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [cutExp, setCutExp] = useState(10);
  const [growInc, setGrowInc] = useState(0);
  const [copiedDebt, setCopiedDebt] = useState<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const request = useCallback(async (url: string, options: RequestInit = {}) => {
    const data = initData();
    if (!data) throw new Error("AI maslahatchi uchun Telegram Mini App ichidan kirish kerak. Brauzer preview rejimida shaxsiy ma'lumotlarga ruxsat berilmaydi.");
    const headers = new Headers(options.headers);
    headers.set("x-telegram-init-data", data);
    headers.set("x-lang", lang); // AI shu tilda javob beradi, tezkor xulosalar ham shu tilda keladi
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await fetch(url, { ...options, headers, cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "So'rov bajarilmadi.");
    return result;
  }, [lang]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await request("/api/ai");
      setMessages(data.messages || []); setConversationId(data.conversationId || null); setMemory(data.memory || { enabled: false, content: "" }); setGoals(data.goals || []); setInsights(data.insights || []); setAnalytics(data.analytics || null); setConfigured(Boolean(data.configured));
    } catch (e) { setError(e instanceof Error ? e.message : "AI yuklanmadi."); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const el = messagesRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }, [messages, busy, tab]);
  // Yozish maydoni matnga qarab o'sadi (maks. 120px) — sahifa siljimaydi
  useEffect(() => { const el = inputRef.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 120)}px`; }, [input, tab]);

  async function send(e?: FormEvent, suggested?: string) {
    e?.preventDefault(); const message = (suggested ?? input).trim(); if (!message || busy) return;
    setInput(""); setError(""); setMessages(old => [...old, { role: "user", content: message }]); setBusy(true);
    try {
      const result = await request("/api/ai", { method: "POST", body: JSON.stringify({ action: "chat", message, conversationId }) });
      setConversationId(result.conversationId); setMessages(old => [...old, result.message]); if (result.insights) setInsights(result.insights);
    } catch (e) { setError(e instanceof Error ? e.message : "AI javob bermadi."); setMessages(old => old.filter((m, i) => !(i === old.length - 1 && m.role === "user" && m.content === message))); setInput(message); }
    finally { setBusy(false); }
  }

  async function saveMemory() {
    setSavingMemory(true); setError("");
    try { const result = await request("/api/ai", { method: "POST", body: JSON.stringify({ action: "memory", enabled: memory.enabled, content: memory.content }) }); setMemory(result.memory); }
    catch (e) { setError(e instanceof Error ? e.message : "Xotira saqlanmadi."); }
    finally { setSavingMemory(false); }
  }


  async function saveGoal(e: FormEvent) {
    e.preventDefault(); setSavingGoal(true); setError("");
    try {
      const result = await request("/api/ai", { method: "POST", body: JSON.stringify({ action: "goal", title: goalTitle, targetAmount: Number(goalAmount), currentAmount: 0, targetDate: goalDate || null }) });
      setGoals(old => [result.goal, ...old]); setGoalTitle(""); setGoalAmount(""); setGoalDate("");
      setTab("chat");
      void send(undefined, lang === "ru"
        ? `Составь мне реалистичный план накоплений для достижения цели «${result.goal.title}». Сумма цели ${nf(result.goal.targetAmount)} сум${result.goal.targetDate ? `, срок ${result.goal.targetDate.slice(0,10)}` : ""}.`
        : `Menga «${result.goal.title}» maqsadiga erishish uchun real tejash rejasini tuz. Maqsad summasi ${nf(result.goal.targetAmount)} so'm${result.goal.targetDate ? `, muddat ${result.goal.targetDate.slice(0,10)}` : ""}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Maqsad saqlanmadi."); }
    finally { setSavingGoal(false); }
  }

  async function updateGoal(goal: Goal) {
    const raw = prompt(tr("«{title}» uchun hozirgacha yig'ilgan summani kiriting (so'm):", { title: goal.title }), String(goal.currentAmount));
    if (raw === null) return; const currentAmount = Number(raw);
    if (!Number.isFinite(currentAmount) || currentAmount < 0) { setError(tr("Yig'ilgan summa 0 yoki undan katta son bo'lishi kerak.")); return; }
    try { const result = await request("/api/ai", { method: "POST", body: JSON.stringify({ action: "goal-progress", goalId: goal.id, currentAmount }) }); setGoals(old => old.map(g => g.id === goal.id ? result.goal : g)); }
    catch (e) { setError(e instanceof Error ? e.message : "Maqsad yangilanmadi."); }
  }

  async function deleteGoal(goal: Goal) {
    if (!confirm(tr("«{title}» maqsadi o'chirilsinmi?", { title: goal.title }))) return;
    try { await request("/api/ai", { method: "POST", body: JSON.stringify({ action: "goal-delete", goalId: goal.id }) }); setGoals(old => old.filter(g => g.id !== goal.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Maqsad o'chirilmadi."); }
  }

  async function clearHistory() {
    if (!confirm(tr("AI suhbat tarixini o'chirishni tasdiqlaysizmi? Bu amal qaytarilmaydi."))) return;
    try { await request("/api/ai", { method: "POST", body: JSON.stringify({ action: "clear-history" }) }); setMessages([]); setConversationId(null); }
    catch (e) { setError(e instanceof Error ? e.message : "Tarix o'chirilmadi."); }
  }

  async function copyMessage(text: string, idx: number) {
    try { await navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500); } catch { /* clipboard ruxsati yo'q */ }
  }

  async function shareReminder(d: DebtRow) {
    const text = reminderText(d, lang);
    const wa = (window as Window & { Telegram?: { WebApp?: { openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
    if (wa?.openTelegramLink) { wa.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`); return; }
    try { await navigator.clipboard.writeText(text); setCopiedDebt(d.person + d.direction + d.original); setTimeout(() => setCopiedDebt(null), 1600); } catch { /* ruxsat yo'q */ }
  }
  async function copyReminder(d: DebtRow) {
    try { await navigator.clipboard.writeText(reminderText(d, lang)); setCopiedDebt(d.person + d.direction + d.original); setTimeout(() => setCopiedDebt(null), 1600); } catch { /* ruxsat yo'q */ }
  }

  const errText = (m: string) => tr(m);
  const askChip = (prompt: string) => { setTab("chat"); void send(undefined, prompt); };
  const memoryLabel = tr(memory.enabled ? "Yoqilgan" : "O'chirilgan");


  /* ---------- to'liq ekran: viewport, klaviatura, Telegram, orqaga ---------- */
  // onClose har renderda yangi funksiya bo'lishi mumkin — effektlar qayta ishga tushmasligi uchun ref orqali
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  const close = useCallback(() => { tgApp()?.HapticFeedback?.impactOccurred?.("light"); onCloseRef.current?.(); }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const recRef = useRef<SR | null>(null);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    // Sahifa orqasidagi kontent siljimasin, iOS'da klaviatura ochilganda panel ko'tarilsin
    const root = document.documentElement; const vv = window.visualViewport;
    const setH = () => { root.style.setProperty("--aiv-h", `${Math.round(vv?.height ?? window.innerHeight)}px`); window.scrollTo(0, 0); };
    setH(); vv?.addEventListener("resize", setH); vv?.addEventListener("scroll", setH); window.addEventListener("orientationchange", setH);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; document.body.classList.add("aiv-open");
    const tg = tgApp(); const bg = "#050816";
    try {
      tg?.expand?.(); tg?.disableVerticalSwipes?.(); tg?.setHeaderColor?.(bg); tg?.setBackgroundColor?.(bg); tg?.setBottomBarColor?.(bg);
      if (TG_FULLSCREEN && tg?.isVersionAtLeast?.("8.0") && !tg.isFullscreen) tg.requestFullscreen?.();
      tg?.BackButton?.show(); tg?.BackButton?.onClick(close);
    } catch { /* eski Telegram versiyasi */ }
    setFirstName(tg?.initDataUnsafe?.user?.first_name ?? "");
    const SRc = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR });
    setSpeechOk(Boolean(SRc.SpeechRecognition || SRc.webkitSpeechRecognition));
    return () => {
      vv?.removeEventListener("resize", setH); vv?.removeEventListener("scroll", setH); window.removeEventListener("orientationchange", setH);
      root.style.removeProperty("--aiv-h"); document.body.style.overflow = prevOverflow; document.body.classList.remove("aiv-open");
      try { tg?.BackButton?.offClick(close); tg?.BackButton?.hide(); tg?.enableVerticalSwipes?.(); if (tg?.isFullscreen) tg.exitFullscreen?.(); } catch { /* */ }
      recRef.current?.stop();
    };
  }, [close]);

  useEffect(() => { // Android "orqaga" tugmasi / Esc
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (sheet || menuOpen) { setSheet(false); setMenuOpen(false); } else close(); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [close, sheet, menuOpen]);

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition; if (!Ctor) return;
    const rec = new Ctor(); rec.lang = lang === "ru" ? "ru-RU" : "uz-UZ"; rec.interimResults = false;
    rec.onresult = e => { const text = Array.from(e.results).map(r => r[0].transcript).join(" ").trim(); if (text) setInput(v => (v ? `${v} ` : "") + text); };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); try { rec.start(); } catch { setListening(false); }
  }

  const hour = new Date().getHours();
  const greet = hour < 5 ? tr("Xayrli tun") : hour < 12 ? tr("Xayrli tong") : hour < 18 ? tr("Xayrli kun") : tr("Xayrli kech");
  const tabs = [["chat", MessageCircle, tr("Maslahat")], ["stats", BarChart3, tr("Tahlil")], ["debts", HandCoins, tr("Qarzlar")], ["goals", Target, tr("Maqsad")], ["memory", Brain, tr("Xotira")]] as const;
  const empty = !loading && messages.length === 0;
  const pick = (c: typeof CHIPS[number]) => { setSheet(false); askChip(c.prompt[lang]); };

  return <section className="aiv" role="dialog" aria-modal="true" aria-label={tr("Hisobchi AI")}>
    <div className="aiv-glow" aria-hidden/>
    <header className="aiv-top">
      <button className="aiv-round" onClick={close} aria-label={tr("Asosiy menyuga qaytish")}><ArrowLeft size={20}/></button>
      <button className="aiv-pill" onClick={() => setTab("chat")}><span className="aiv-pill-dot"/>{tr("Hisobchi AI")}<small>{tr("Moliyaviy yordamchi")}</small></button>
      <div className="aiv-menu-wrap">
        <button className="aiv-round" onClick={() => setMenuOpen(v => !v)} aria-label={tr("Menyu")} aria-expanded={menuOpen}>{menuOpen ? <X size={19}/> : <span className="aiv-dots-icon"><i/><i/><i/></span>}</button>
        {menuOpen && <><div className="aiv-scrim" onClick={() => setMenuOpen(false)}/><div className="aiv-popover" role="menu">
          <button role="menuitem" onClick={() => { setMenuOpen(false); setTab("memory"); }}><Brain size={16}/>{tr("Xotira")}</button>
          <button role="menuitem" onClick={() => { setMenuOpen(false); setTab("goals"); }}><Target size={16}/>{tr("Maqsad")}</button>
          <button role="menuitem" className="danger" onClick={() => { setMenuOpen(false); void clearHistory(); }}><Trash2 size={16}/>{tr("Suhbat tarixini tozalash")}</button>
        </div></>}
      </div>
    </header>

    <nav className="aiv-tabs" role="tablist">
      {tabs.map(([id, Icon, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon size={15}/>{label}</button>)}
    </nav>

    {!configured && <div className="ai-alert aiv-alert">{tr("AI provayderlari sozlanmagan. Serverning")} <code>.env</code> {tr("fayliga GEMINI_API_KEY yoki GROQ_API_KEY qo'shing.")}</div>}
    {error && <div className="ai-alert aiv-alert" role="alert">{errText(error)}<button onClick={() => setError("")} aria-label="OK"><X size={14}/></button></div>}

    {tab === "chat" ? <>
      <div className="aiv-scroll" ref={messagesRef}>
        {loading ? <div className="aiv-hero"><AiBot size={96} state="thinking"/><p className="aiv-muted">{tr("Yuklanmoqda...")}</p></div>
        : empty ? <div className="aiv-hero">
          <AiBot size={132}/>
          <h1>{greet}{firstName ? `, ${firstName}` : ""}</h1>
          <p>{tr("Pulingiz qayerga ketayotganini birga tahlil qilamiz.")}</p>
          {insights.length > 0 && <div className="aiv-insights">{insights.slice(0, 3).map(i => <div key={i.id} className={`aiv-insight ${i.tone}`}><strong>{i.title}</strong><span>{i.text}</span></div>)}</div>}
          <div className="aiv-suggest">{CHIPS.slice(0, 4).map(c => <button key={c.label.uz} disabled={busy} onClick={() => pick(c)}><span>{c.emoji}</span><b>{c.label[lang]}</b></button>)}</div>
        </div>
        : <div className="aiv-thread">
          {messages.map((m, i) => m.role === "user"
            ? <div key={m.id || `${i}-u`} className="aiv-msg user"><div className="aiv-bubble">{m.content}</div></div>
            : <div key={m.id || `${i}-a`} className="aiv-msg assistant">
              <div className="aiv-avatar"><AiBot size={34}/></div>
              <div className="aiv-reply"><div className="aiv-text"><RichText text={m.content}/></div>
                <div className="aiv-actions"><button onClick={() => void copyMessage(m.content, i)} aria-label={tr("Nusxalash")}>{copiedIdx === i ? <Check size={14}/> : <Copy size={14}/>}</button><span>{m.provider === "gemini" ? "Gemini" : m.provider === "groq" ? "Groq" : ""}</span></div></div>
            </div>)}
          {busy && <div className="aiv-msg assistant"><div className="aiv-avatar"><AiBot size={34} state="thinking"/></div><div className="aiv-reply"><div className="aiv-typing"><span/><span/><span/></div></div></div>}
        </div>}
        <div ref={bottomRef}/>
      </div>

      <div className="aiv-dock">
        {!empty && !loading && <div className="aiv-chips">{CHIPS.map(c => <button key={c.label.uz} disabled={busy} onClick={() => pick(c)}><span>{c.emoji}</span>{c.label[lang]}</button>)}</div>}
        <form className="aiv-composer" onSubmit={e => void send(e)}>
          <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder={listening ? tr("Eshitilmoqda...") : tr("Savolingizni yozing...")} rows={1} maxLength={1500} disabled={busy || loading} enterKeyHint="send"
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(pointer:fine)").matches) { e.preventDefault(); void send(); } }}/>
          <div className="aiv-composer-row">
            <button type="button" className="aiv-tool" onClick={() => setSheet(true)} aria-label={tr("Tezkor savollar")}><Plus size={20}/></button>
            <button type="button" className="aiv-tool aiv-model" onClick={() => setSheet(true)}><Sparkles size={14}/>{tr("Moliya rejimi")}</button>
            <span className="aiv-grow"/>
            {speechOk && <button type="button" className={`aiv-tool ${listening ? "rec" : ""}`} onClick={toggleMic} aria-label={tr("Ovozli kiritish")}><Mic size={19}/></button>}
            <button type="submit" className="aiv-send" disabled={!input.trim() || busy || loading} aria-label={tr("Xabar yuborish")}>{busy ? <Loader2 size={18} className="ai-spin"/> : <ArrowUp size={20} strokeWidth={2.6}/>}</button>
          </div>
        </form>
        <p className="aiv-disclaimer">{tr("AI xato qilishi mumkin. Muhim qarorlarni tekshirib oling.")}</p>
      </div>
    </> : <div className="aiv-scroll aiv-sub"><div className="ai-page page-stack">
    {tab === "stats" && <>
      {!analytics ? <div className="ai-empty"><Loader2 className="ai-spin" size={22}/><p>{tr("Yuklanmoqda...")}</p></div> : <>
        <div className="ai-card">
          <div className="ai-card-title"><HeartPulse size={16}/> {tr("Moliyaviy sog'liq bali")} <span>{tr("AI'siz, bepul")}</span></div>
          {analytics.score ? <div className="ai-score">
            <div className="ai-score-ring"><ScoreRing value={analytics.score.value}/><strong>{analytics.score.label}</strong></div>
            <div className="ai-score-parts">{analytics.score.parts.map(p => <div key={p.label}><div className="ai-score-row"><span>{p.label}</span><b>{p.points}/{p.max}</b></div><div className="ai-goal-track"><span style={{ width: `${p.points / p.max * 100}%` }}/></div><small>{p.hint}</small></div>)}</div>
          </div> : <p className="ai-muted">{tr("Ball hisoblash uchun kamida 5 ta operatsiya kiriting.")}</p>}
        </div>

        <div className="ai-card">
          <div className="ai-card-title"><Wallet size={16}/> {tr("Bugun xavfsiz sarflash limiti")}</div>
          {analytics.safeDaily ? <>
            <div className={`ai-safe ${analytics.safeDaily.status}`}><strong>{fmtN(analytics.safeDaily.perDay)}</strong><span>{tr("so'm / kun")}</span></div>
            <p className="ai-muted">{analytics.safeDaily.status === "over" ? tr("Bu oy xarajat kutilgan daromaddan oshib ketdi — yangi xarajatlarni minimal tuting.") : `${tr("Oy oxirigacha {days} kun, {left} so'm qoldi. Hozirgi o'rtacha: {avg} so'm/kun", { days: analytics.safeDaily.daysLeft, left: fmtN(Math.max(0, analytics.safeDaily.remaining)), avg: fmtN(analytics.safeDaily.avgDaily) })}${analytics.safeDaily.status === "tight" ? tr(" — limitdan yuqori.") : tr(" — joyida.")}`}</p>
          </> : <p className="ai-muted">{tr("Daromad kiritilgach limit hisoblanadi.")}</p>}
        </div>

        <div className="ai-card">
          <div className="ai-card-title"><AlertTriangle size={16}/> {tr("Odatdan tashqari xarajatlar")}</div>
          {analytics.anomalies.length ? analytics.anomalies.map(a => <div key={a.id} className="ai-anomaly"><strong>{a.title}</strong><p>{a.text}</p></div>) : <p className="ai-muted">{tr("Hozircha g'ayrioddiy xarajat topilmadi.")} 👍</p>}
          {analytics.anomalies.length > 0 && <button className="ai-link-btn" onClick={() => askChip(lang === "ru" ? "Объясни мои необычные расходы и подскажи, как их контролировать." : "Odatdan tashqari xarajatlarimni tushuntir va qanday nazorat qilishni ayt.")}>{tr("AI bilan muhokama qilish")}</button>}
        </div>

        <div className="ai-card">
          <div className="ai-card-title"><SlidersHorizontal size={16}/> {tr("\"Agar... bo'lsa?\" simulyatori")}</div>
          {analytics.whatIf.avgExpense > 0 || analytics.whatIf.avgIncome > 0 ? (() => {
            const saveM = analytics.whatIf.avgExpense * cutExp / 100, earnM = analytics.whatIf.avgIncome * growInc / 100, totalM = saveM + earnM;
            return <>
              <label className="ai-slider"><span>{tr("Xarajatni kamaytirsam")}: <b>{cutExp}%</b></span><input type="range" min={0} max={40} step={5} value={cutExp} onChange={e => setCutExp(Number(e.target.value))}/></label>
              <label className="ai-slider"><span>{tr("Daromadni oshirsam")}: <b>{growInc}%</b></span><input type="range" min={0} max={50} step={5} value={growInc} onChange={e => setGrowInc(Number(e.target.value))}/></label>
              <div className="ai-whatif"><div><small>{tr("Oyiga")}</small><strong>+{fmtN(totalM)}</strong></div><div><small>{tr("1 yilda")}</small><strong>+{fmtN(totalM * 12)}</strong></div><div><small>{tr("5 yilda")}</small><strong>+{fmtN(totalM * 60)}</strong></div></div>
              <p className="ai-muted">{tr("O'rtacha oylik xarajat {exp}, daromad {inc} so'm asosida. Narx o'zgarmaydi va foiz qo'shilmaydi, deb faraz qilingan.", { exp: fmtN(analytics.whatIf.avgExpense), inc: fmtN(analytics.whatIf.avgIncome) })}</p>
            </>;
          })() : <p className="ai-muted">{tr("Hisoblash uchun operatsiyalar kerak.")}</p>}
        </div>
      </>}
    </>}

    {tab === "debts" && <>
      {!analytics ? <div className="ai-empty"><Loader2 className="ai-spin" size={22}/><p>{tr("Yuklanmoqda...")}</p></div> : <>
        <div className="ai-debt-stats">
          <div><small>{tr("Menga qaytishi kerak")}</small><strong className="pos">{fmtN(analytics.debts.receivable)}</strong><em>{tr("{n} qaytgan", { n: fmtN(analytics.debts.receivablePaid) })}</em></div>
          <div><small>{tr("Men qaytarishim kerak")}</small><strong className="neg">{fmtN(analytics.debts.payable)}</strong><em>{tr("{n} qaytargan", { n: fmtN(analytics.debts.payablePaid) })}</em></div>
        </div>
        {analytics.debts.overdue > 0 && <div className="ai-alert">{tr("Muddati o'tgan qarzlar: {n} ta.", { n: analytics.debts.overdue })}</div>}
        {analytics.debts.rows.length === 0 ? <div className="ai-empty"><div className="ai-empty-icon"><HandCoins size={24}/></div><strong>{tr("Qarzlar yo'q")}</strong><p>{tr("«Qarzlar» bo'limida qarz qo'shsangiz, shu yerda ismlar bilan ko'rinadi.")}</p></div> : <div className="ai-card">
          <div className="ai-card-title"><HandCoins size={16}/> {tr("Ismlar va qarzlar")}</div>
          {analytics.debts.rows.map((d, i) => { const pct = d.original ? Math.min(100, d.paid / d.original * 100) : 0; const key = d.person + d.direction + d.original; return <div key={`${key}-${i}`} className={`ai-debt ${d.remaining === 0 ? "closed" : ""}`}>
            <div className="ai-debt-top"><strong>{d.person}</strong><span className={`ai-badge ${d.direction === "LENT" ? "lent" : "borrowed"}`}>{tr(d.direction === "LENT" ? "Men bergan" : "Men olgan")}</span></div>
            <div className="ai-goal-track"><span style={{ width: `${pct}%` }}/></div>
            <div className="ai-debt-nums"><span>{tr("Berilgan")}: <b>{fmtN(d.original)}</b></span><span>{tr(d.direction === "LENT" ? "Qaytdi" : "Qaytardim")}: <b>{fmtN(d.paid)}</b></span><span>{tr("Qoldi")}: <b>{fmtN(d.remaining)}</b></span></div>
            <div className="ai-debt-meta">{d.remaining === 0 ? tr("✅ To'liq yopilgan") : d.due ? `${d.overdue ? tr("⚠️ Muddati o'tgan: ") : tr("Muddat: ")}${d.due}` : tr("Muddat belgilanmagan")}</div>
            {d.direction === "LENT" && d.remaining > 0 && <div className="ai-goal-actions"><button onClick={() => void copyReminder(d)}>{copiedDebt === key ? tr("Nusxalandi ✓") : tr("Eslatma matnini nusxalash")}</button><button onClick={() => void shareReminder(d)}><Share2 size={11}/> {tr("Telegramda yuborish")}</button></div>}
          </div>; })}
        </div>}
        <button className="primary-action ai-wide" onClick={() => askChip(CHIPS[5].prompt[lang])}><Sparkles size={15}/> {tr("AI bilan qarzlarni tahlil qilish")}</button>
      </>}
    </>}

    {tab === "goals" && <div className="ai-goals-card">
      <div className="ai-goals-heading"><div><strong><Target size={17}/> {tr("Moliyaviy maqsadlar")}</strong><p>{tr("Maqsad qo'shsangiz, AI darhol tejash rejasini tuzib beradi.")}</p></div><span>{goals.length}/30</span></div>
      {goals.length > 0 && <div className="ai-goal-list">{goals.map(g => { const pct = Math.min(100, g.targetAmount > 0 ? g.currentAmount / g.targetAmount * 100 : 0); return <div className="ai-goal-item" key={g.id}><div className="ai-goal-title"><strong>{g.title}</strong><span>{nf(g.targetAmount)} {lang === "ru" ? "сум" : "so'm"}</span></div><div className="ai-goal-track"><span style={{ width: `${pct}%` }}/></div><div className="ai-goal-meta"><span>{tr("{n} so'm yig'ilgan ({pct}%)", { n: nf(g.currentAmount), pct: Math.round(pct) })}</span><span>{g.targetDate ? `${tr("Muddat: ")}${g.targetDate.slice(0,10)}` : tr("Muddat yo'q")}</span></div>{(() => { if (!g.targetDate || g.currentAmount >= g.targetAmount) return null; const days = Math.ceil((new Date(g.targetDate).getTime() - Date.now()) / 86400000); if (days <= 0) return <div className="ai-goal-pace warn">{tr("Muddat o'tgan — {n} so'm qoldi", { n: fmtN(g.targetAmount - g.currentAmount) })}</div>; return <div className="ai-goal-pace">{tr("Kuniga ≈ {day} so'm · oyiga ≈ {month} so'm kerak ({days} kun qoldi)", { day: fmtN((g.targetAmount - g.currentAmount) / days), month: fmtN((g.targetAmount - g.currentAmount) / days * 30), days })}</div>; })()}<div className="ai-goal-actions"><button onClick={() => askChip(lang === "ru" ? `Сколько мне нужно откладывать в день на цель «${g.title}»? Ответь кратко.` : `«${g.title}» maqsadim uchun kuniga qancha ajratishim kerak? Qisqa javob ber.`)}>{tr("AI reja")}</button><button onClick={() => void updateGoal(g)}>{tr("Summani yangilash")}</button><button onClick={() => void deleteGoal(g)}>{tr("O'chirish")}</button></div></div>; })}</div>}
      <form className="ai-goal-form" onSubmit={e => void saveGoal(e)}><input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} maxLength={100} minLength={2} required placeholder={tr("Masalan: Favqulodda jamg'arma")}/><div className="ai-goal-fields"><input type="number" min="1" max="1000000000000" step="any" required value={goalAmount} onChange={e => setGoalAmount(e.target.value)} placeholder={tr("Summa (so'm)")}/><input type="date" value={goalDate} onChange={e => setGoalDate(e.target.value)} aria-label={tr("Maqsad muddati")}/></div><button className="primary-action" type="submit" disabled={savingGoal || goals.length >= 30}>{savingGoal ? <Loader2 size={15} className="ai-spin"/> : <Target size={15}/>} {tr("Maqsadni saqlash")}</button></form>
    </div>}

    {tab === "memory" && <div className="ai-memory-card">
      <div className="ai-memory-top"><span className="ai-memory-icon"><ShieldCheck size={18}/></span><div className="ai-memory-copy"><strong>{tr("Shaxsiy xotira")} · {memoryLabel}</strong><p>{tr("AI sizning maqsad va afzalliklaringizni har suhbatda hisobga oladi. Faqat siz yozganingiz ishlatiladi.")}</p></div></div>
      <div className="ai-memory-editor"><label className="ai-toggle"><input type="checkbox" checked={memory.enabled} onChange={e => setMemory(v => ({ ...v, enabled: e.target.checked }))}/> {tr("Xotiradan foydalanishga roziman")}</label><label htmlFor="ai-memory-content">{tr("Men uchun muhim narsalar")}</label><textarea id="ai-memory-content" maxLength={3000} value={memory.content} onChange={e => setMemory(v => ({ ...v, content: e.target.value }))} placeholder={tr("Masalan: 6 oyda favqulodda jamg'arma yig'moqchiman. Daromadim o'zgaruvchan.")}/><div className="ai-memory-actions"><span>{memory.content.length}/3000</span><button className="primary-action" onClick={() => void saveMemory()} disabled={savingMemory}>{savingMemory ? <Loader2 size={15} className="ai-spin"/> : <Save size={15}/>} {tr("Saqlash")}</button></div><p className="ai-privacy-note">{tr("Karta raqami, parol yoki boshqa maxfiy ma'lumot yozmang.")}</p></div>
    </div>}
    </div></div>}

    {sheet && <><div className="aiv-scrim dim" onClick={() => setSheet(false)}/><div className="aiv-sheet" role="dialog" aria-label={tr("Tezkor savollar")}>
      <div className="aiv-grab"/><div className="aiv-sheet-head"><strong>{tr("Tezkor savollar")}</strong><button onClick={() => setSheet(false)} aria-label="close"><X size={18}/></button></div>
      <div className="aiv-sheet-list">{CHIPS.map(c => <button key={c.label.uz} disabled={busy} onClick={() => pick(c)}><span>{c.emoji}</span>{c.label[lang]}</button>)}
        <button onClick={() => { setSheet(false); setInput(v => v || (lang === "ru" ? "Если мои ежемесячные расходы сократятся на ... сум, " : "Agar oylik xarajatim ... so'mga kamaysa, ")); inputRef.current?.focus(); }}><span>🧪</span>{tr("Agar... bo'lsa?")}</button></div>
    </div></>}
  </section>;
}
