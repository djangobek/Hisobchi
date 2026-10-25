"use client";

import { useEffect, useMemo, useState, useRef, type FormEvent } from "react";
import {
  ArrowDownLeft, ArrowRight, Check, ChevronLeft, ChevronRight, CircleHelp,
  ClipboardList, HandCoins, Home, ListPlus, MoreHorizontal, Plus, Receipt,
  Settings2, ShieldCheck, Languages, TrendingDown, TrendingUp, UserRound, Wallet, X,
  Utensils, Car, House, ShoppingBag, GraduationCap, HeartPulse, BrainCircuit,
  BriefcaseBusiness, Gift, Pencil, Trash2, CircleDollarSign, History,
} from "lucide-react";
import { formatUZS, parseAmount } from "@/lib/currency";
import { localDateKey, monthLabel } from "@/lib/dates";
import { summarize, summarizeDay, debtRemaining, type Tx } from "@/lib/finance";
import AiAdvisor from "@/components/ai-advisor";
import { useI18n } from "@/lib/i18n-client";
import { formatNum } from "@/lib/i18n";

/* ---------------- TYPES ---------------- */
type Transaction = Tx & { id: string; categoryId: string; note: string; type: "INCOME" | "EXPENSE"; occurredAt: string };
type Category = { id: string; name: string; type: "INCOME" | "EXPENSE"; icon: string; color: string };
type Debt = { id: string; personName: string; direction: "LENT" | "BORROWED"; originalAmount: number; occurredAt: string; dueAt?: string; note: string; repayments: number[]; repaymentDates?: string[] };

/* ---------------- CATEGORIES (with colors for donut) ---------------- */
const defaultCategories: Category[] = [
  { id: "e1", name: "Ovqatlanish", type: "EXPENSE", icon: "food", color: "#f97316" },
  { id: "e2", name: "Oziq-ovqat", type: "EXPENSE", icon: "food", color: "#eab308" },
  { id: "e3", name: "Transport", type: "EXPENSE", icon: "car", color: "#3b82f6" },
  { id: "e4", name: "Uy-joy", type: "EXPENSE", icon: "home", color: "#8b5cf6" },
  { id: "e5", name: "Kiyim-kechak", type: "EXPENSE", icon: "bag", color: "#ec4899" },
  { id: "e6", name: "Ta'lim", type: "EXPENSE", icon: "study", color: "#06b6d4" },
  { id: "e7", name: "Sog'liq", type: "EXPENSE", icon: "health", color: "#ef4444" },
  { id: "e8", name: "Ko'ngilochar", type: "EXPENSE", icon: "fun", color: "#a855f7" },
  { id: "e9", name: "Boshqa", type: "EXPENSE", icon: "other", color: "#64748b" },
  { id: "i1", name: "Ish haqi", type: "INCOME", icon: "work", color: "#22c55e" },
  { id: "i2", name: "Qo'shimcha ish", type: "INCOME", icon: "work", color: "#16a34a" },
  { id: "i3", name: "Freelance", type: "INCOME", icon: "work", color: "#10b981" },
  { id: "i4", name: "Savdo", type: "INCOME", icon: "other", color: "#14b8a6" },
  { id: "i5", name: "Sovg'a", type: "INCOME", icon: "gift", color: "#84cc16" },
  { id: "i6", name: "Boshqa tushum", type: "INCOME", icon: "other", color: "#4ade80" },
];

const demoTransactions: Transaction[] = [];
const dateISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function categoryIcon(name: string) {
  if (/ovqat|taom/i.test(name)) return <Utensils size={18} />;
  if (/transport/i.test(name)) return <Car size={18} />;
  if (/uy/i.test(name)) return <House size={18} />;
  if (/kiyim/i.test(name)) return <ShoppingBag size={18} />;
  if (/ta'lim|ta'lim/i.test(name)) return <GraduationCap size={18} />;
  if (/sog/i.test(name)) return <HeartPulse size={18} />;
  if (/ish|freelance/i.test(name)) return <BriefcaseBusiness size={18} />;
  if (/sovg/i.test(name)) return <Gift size={18} />;
  return <CircleDollarSign size={18} />;
}

/* ---------------- DONUT CHART COMPONENT ---------------- */
function DonutChart({ data, total }: { data: { name: string; value: number; color: string; pct: number }[]; total: number }) {
  const { t: tr, lang } = useI18n();
  const size = 148, stroke = 18, radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (!data.length || total === 0) {
    return (
      <div className="donut-wrap">
        <div className="empty-state" style={{ padding: "20px 0", width: "100%" }}>
          <div className="empty-copy">{tr("Xarajat qo'shilgach, diagramma shu yerda ko'rinadi.")}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="donut-wrap">
      <svg className="donut-svg" viewBox={`0 0 ${size} ${size}`} aria-label={tr("Kategoriyalar bo'yicha xarajat diagrammasi")}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
        {data.map((d, i) => {
          const length = (d.value / total) * circumference;
          const dasharray = `${length} ${circumference - length}`;
          const dashoffset = -offset;
          offset += length;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className="donut-segment"
            >
              <title>{`${d.name}: ${d.pct.toFixed(1)}%`}</title>
            </circle>
          );
        })}
        <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className="donut-center-label">{tr("JAMI")}</text>
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className="donut-center-value">{formatNum(total, lang)}</text>
      </svg>
      <div className="donut-legend">
        {data.slice(0, 6).map((d, i) => (
          <div key={i} className="legend-item">
            <span className="legend-dot" style={{ background: d.color }} />
            <span className="legend-name">{d.name}</span>
            <span className="legend-pct">{d.pct.toFixed(0)}%</span>
            <span className="legend-amt">{formatUZS(d.value, lang)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- MAIN APP ---------------- */
export default function FinanceApp({ onSwitchToAdmin }: { onSwitchToAdmin?: () => void } = {}) {
  const { t: tr, lang, setLang, cat: catLabel, locale } = useI18n();
  const [transactions, setTransactions] = useState<Transaction[]>(demoTransactions);
  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [page, setPage] = useState("Asosiy");
  const [reportTab, setReportTab] = useState("Oylik statistika");
  const [debtTab, setDebtTab] = useState<"LENT" | "BORROWED">("LENT");
  const [modal, setModal] = useState<"EXPENSE" | "INCOME" | "DEBT" | "CATEGORY" | "REPAY" | "EDIT" | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"INCOME" | "EXPENSE">("EXPENSE");
  const [categoryId, setCategoryId] = useState("e1");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(dateISO(new Date()));
  const [person, setPerson] = useState("");
  const [direction, setDirection] = useState<"LENT" | "BORROWED">("LENT");
  const [dueDate, setDueDate] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [repayAmount, setRepayAmount] = useState("");
  const [repayDebtId, setRepayDebtId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [serverMode, setServerMode] = useState(false);
  const [announcement, setAnnouncement] = useState<{title:string;message:string;updatedAt?:string}|null>(null);
  const [announcementHidden, setAnnouncementHidden] = useState(false);
  const lastServerSnapshot = useRef("");
  const persistenceBlocked = useRef(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!serverMode) return;
    let alive = true;
    const loadAnnouncement = async () => {
      const initData = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";
      if (!initData) return;
      try {
        const r = await fetch("/api/announcement", { headers: { "x-telegram-init-data": initData }, cache: "no-store" });
        if (r.ok && alive) setAnnouncement(await r.json());
      } catch { /* transient network error; keep current announcement */ }
    };
    void loadAnnouncement();
    const timer = window.setInterval(loadAnnouncement, 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [serverMode]);

  /* ---------- SERVER-FIRST PERSISTENCE ---------- */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const initData = (window as Window & { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } } }).Telegram?.WebApp?.initData ?? "";
      if (initData) {
        try {
          const authResponse = await fetch("/api/auth/telegram", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initData }), cache: "no-store",
          });
          const authResult = await authResponse.json().catch(() => ({}));
          if (!authResponse.ok || authResult.isBlocked) throw new Error(authResult.error || "Telegram foydalanuvchisi bloklangan.");
          // Server tilini ustun qo'yamiz (botda /lang bilan o'zgartirilgan bo'lishi mumkin).
          if (authResult.language === "uz" || authResult.language === "ru") setLang(authResult.language, { persist: false });
          const headers = { "x-telegram-init-data": initData };
          const response = await fetch("/api/data", { headers, cache: "no-store" });
          if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Server ma’lumotlarini yuklab bo‘lmadi.");
          const data = await response.json();
          if (cancelled) return;
          const normalized = {
            categories: Array.isArray(data.categories) ? data.categories : defaultCategories,
            transactions: Array.isArray(data.transactions) ? data.transactions : [],
            debts: Array.isArray(data.debts) ? data.debts : [],
          };
          setCategories(normalized.categories);
          setTransactions(normalized.transactions);
          setDebts(normalized.debts);
          lastServerSnapshot.current = JSON.stringify(normalized);
          setServerMode(true);
          setError("");
          const webApp = (window as Window & { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } }).Telegram?.WebApp;
          webApp?.ready?.(); webApp?.expand?.();
        } catch (err) {
          if (!cancelled) {
            console.error("Server persistence unavailable:", err);
            setError("Server bazasiga ulanib bo‘lmadi. Ma’lumotlar serverga saqlanmayapti. Internet va server sozlamalarini tekshiring.");
            // Do not silently fall back to localStorage: that would make data appear saved when it is not.
            setTransactions([]); setDebts([]); setCategories(defaultCategories);
          }
        } finally {
          if (!cancelled) setPersistenceReady(true);
        }
      } else {
        // Local browser mode is only a preview; it is deliberately not represented as server-persisted.
        try {
          const raw = localStorage.getItem("hisobchi-state-v1");
          if (raw) {
            const d = JSON.parse(raw);
            if (d && typeof d === "object") {
              setTransactions(Array.isArray(d.transactions) ? d.transactions : []);
              setCategories(Array.isArray(d.categories) && d.categories.length ? d.categories : defaultCategories);
              setDebts(Array.isArray(d.debts) ? d.debts : []);
            }
          }
          setError("Telegram Mini App sessiyasi topilmadi. Brauzer rejimida serverga saqlash yoqilmagan.");
        } catch (err) {
          persistenceBlocked.current = true;
          console.error("Local preview data could not be restored:", err);
          setError("Mahalliy ma’lumotlarni o‘qib bo‘lmadi; avtomatik ustidan yozish to‘xtatildi.");
        } finally {
          if (!cancelled) setPersistenceReady(true);
        }
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!persistenceReady || persistenceBlocked.current) return;
    const snapshot = JSON.stringify({ categories, transactions, debts });
    if (serverMode) {
      if (snapshot === lastServerSnapshot.current) return;
      const initData = (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";
      if (!initData) { setError("Telegram sessiyasi yo‘q; serverga saqlash bajarilmadi."); return; }
      const controller = new AbortController();
      const timer = window.setTimeout(async () => {
        try {
          const response = await fetch("/api/data", {
            method: "PUT", headers: { "Content-Type": "application/json", "x-telegram-init-data": initData },
            body: snapshot, signal: controller.signal,
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Serverga saqlash bajarilmadi.");
          const refresh = await fetch("/api/data", { headers: { "x-telegram-init-data": initData }, cache: "no-store", signal: controller.signal });
          if (!refresh.ok) throw new Error("Saqlangan ma’lumotlarni qayta tekshirish bajarilmadi.");
          const canonical = await refresh.json();
          const normalized = { categories: canonical.categories ?? [], transactions: canonical.transactions ?? [], debts: canonical.debts ?? [] };
          lastServerSnapshot.current = JSON.stringify(normalized);
          setCategories(normalized.categories);
          setTransactions(normalized.transactions);
          setDebts(normalized.debts);
          setError("");
        } catch (err) {
          if (!controller.signal.aborted) {
            console.error("Server save failed:", err);
            setError(`Serverga saqlash xatosi: ${err instanceof Error ? err.message : "noma’lum xato"}`);
          }
        }
      }, 350);
      return () => { window.clearTimeout(timer); controller.abort(); };
    }
    // Browser-only preview; never presented as persistent server storage.
    try {
      localStorage.setItem("hisobchi-state-v1", JSON.stringify({ version: 1, savedAt: new Date().toISOString(), categories, transactions, debts }));
    } catch (err) {
      console.error("Local preview data could not be saved:", err);
      setError("Brauzer xotirasiga saqlash amalga oshmadi. Telegram Mini App orqali serverga kiring.");
    }
  }, [persistenceReady, serverMode, categories, transactions, debts]);

  /* ---------- ESC TO CLOSE + FOCUS ---------- */
  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    setTimeout(() => amountInputRef.current?.focus(), 80);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  /* ---------- DERIVED ---------- */
  const summary = useMemo(() => summarize(transactions, month.getFullYear(), month.getMonth()), [transactions, month]);
  const todayExpense = useMemo(() => summarizeDay(transactions, new Date()).expenses, [transactions]);
  const monthRows = [...summary.transactions].sort((a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt));

  const categoryTotals = useMemo(
    () => categories
      .filter(c => c.type === "EXPENSE")
      .map(c => ({
        ...c,
        total: summary.transactions.filter(t => t.type === "EXPENSE" && t.categoryId === c.id).reduce((s, t) => s + t.amount, 0),
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total),
    [categories, summary.transactions]
  );

  const donutData = useMemo(() => {
    const totalExp = categoryTotals.reduce((s, c) => s + c.total, 0);
    return categoryTotals.map(c => ({ name: c.name, value: c.total, color: c.color || "#3b82f6", pct: totalExp ? (c.total / totalExp) * 100 : 0 }));
  }, [categoryTotals]);

  const donutTotal = useMemo(() => categoryTotals.reduce((s, c) => s + c.total, 0), [categoryTotals]);

  /* ---------- HELPERS ---------- */
  // Xatolar o'zbekcha saqlanadi, ko'rsatishda tilga qarab tarjima qilinadi.
  const errText = (msg: string) => {
    const prefix = "Serverga saqlash xatosi: ";
    return msg.startsWith(prefix) ? `${tr("Serverga saqlash xatosi")}: ${tr(msg.slice(prefix.length))}` : tr(msg);
  };
  const fmt = (v: number) => formatUZS(v, lang);
  const dShort = (iso: string | Date) => new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" });
  const dLong = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 2400);
  };

  const openForm = (kind: "EXPENSE" | "INCOME" | "DEBT" | "CATEGORY" | "EDIT", forDate?: Date) => {
    setError("");
    setAmount("");
    setNote("");
    setPerson("");
    setDueDate("");
    setNewCategory("");
    setSubmitting(false);
    const targetDate = forDate ?? new Date();
    setDate(dateISO(targetDate));
    setType(kind === "INCOME" ? "INCOME" : "EXPENSE");
    setCategoryId(categories.find(c => c.type === (kind === "INCOME" ? "INCOME" : "EXPENSE"))?.id ?? "");
    setModal(kind);
    setEditId(null);
  };

  const editTransaction = (t: Transaction) => {
    setEditId(t.id);
    setAmount(String(t.amount));
    setType(t.type);
    setCategoryId(t.categoryId);
    setNote(t.note);
    setDate(dateISO(new Date(t.occurredAt)));
    setError("");
    setModal("EDIT");
  };

  const saveTransaction = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const value = parseAmount(amount);
      if (!categoryId) throw new Error("Kategoriyani tanlang.");
      const cat = categories.find(c => c.id === categoryId);
      if (!cat || cat.type !== type) throw new Error("Tanlangan kategoriya mos emas.");
      const item: Transaction = {
        id: editId ?? crypto.randomUUID(),
        amount: value,
        type,
        categoryId,
        note: note.trim(),
        occurredAt: new Date(`${date}T12:00:00`).toISOString(),
      };
      setTransactions(prev => editId ? prev.map(t => t.id === editId ? item : t) : [item, ...prev]);
      setMonth(new Date(`${date}T12:00:00`));
      setModal(null);
      showNotice(editId ? "Tranzaksiya yangilandi" : "Tranzaksiya saqlandi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ma'lumotlarni tekshiring.");
      setSubmitting(false);
    }
  };

  const removeTransaction = (id: string) => {
    if (!window.confirm(tr("Ushbu tranzaksiyani o'chirmoqchimisiz?"))) return;
    setTransactions(p => p.filter(t => t.id !== id));
    showNotice("Tranzaksiya o'chirildi");
  };

  const saveDebt = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const value = parseAmount(amount);
      if (!person.trim()) throw new Error("Shaxs ismini kiriting.");
      setDebts(p => [{
        id: crypto.randomUUID(),
        personName: person.trim(),
        direction,
        originalAmount: value,
        occurredAt: new Date(`${date}T12:00:00`).toISOString(),
        dueAt: dueDate || undefined,
        note,
        repayments: [],
        repaymentDates: [],
      }, ...p]);
      setModal(null);
      showNotice("Qarz saqlandi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ma'lumotlarni tekshiring.");
      setSubmitting(false);
    }
  };

  const saveRepayment = (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const value = parseAmount(repayAmount);
      const debt = debts.find(d => d.id === repayDebtId);
      if (!debt) throw new Error("Qarz topilmadi.");
      const remaining = debtRemaining(debt.originalAmount, debt.repayments).remaining;
      if (value > remaining) throw new Error("To'lov qolgan qarzdan katta bo'lishi mumkin emas.");
      setDebts(p => p.map(d => d.id === repayDebtId ? {
        ...d,
        repayments: [...d.repayments, value],
        repaymentDates: [...(d.repaymentDates ?? []), new Date().toISOString()],
      } : d));
      setModal(null);
      showNotice("Qisman to'lov saqlandi");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ma'lumotlarni tekshiring.");
      setSubmitting(false);
    }
  };

  const saveCategory = (e: FormEvent) => {
    e.preventDefault();
    if (!newCategory.trim()) { setError("Kategoriya nomini kiriting."); return; }
    if (categories.some(c => c.name.toLowerCase() === newCategory.trim().toLowerCase() && c.type === type)) {
      setError("Bu kategoriya allaqachon mavjud."); return;
    }
    const palette = ["#f97316","#3b82f6","#8b5cf6","#ec4899","#06b6d4","#22c55e","#a855f7","#14b8a6"];
    setCategories(p => [...p, { id: crypto.randomUUID(), name: newCategory.trim(), type, icon: "other", color: palette[p.length % palette.length] }]);
    setModal(null);
    showNotice("Kategoriya qo'shildi");
  };

  /* ---------- CALENDAR HELPERS ---------- */
  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return { offset: (first.getDay() + 6) % 7, count };
  }, [month]);

  const calendarRows = useMemo(
    () => Array.from({ length: days.count }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    [days, month]
  );

  const daily = summarizeDay(transactions, selectedDate);
  const debtRows = debts.filter(d => d.direction === debtTab);
  const nav = [{ name: "Asosiy", icon: Home }, { name: "Hisobot", icon: ClipboardList }, { name: "AI", icon: BrainCircuit }, { name: "Qarzlar", icon: HandCoins }, { name: "Profil", icon: UserRound }];

  return (
    <>
      <main className="app-shell">
        {error && !modal && <div className="form-error" role="alert" style={{ margin: "8px 16px" }}>{errText(error)}</div>}
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark"><Wallet size={23} /></div>
            <div>
              <div className="eyebrow">{tr("SHAXSIY MOLIYA")}</div>
              <h1 className="heading">{page === "Asosiy" ? tr("Xush kelibsiz") : page === "AI" ? tr("AI maslahatchi") : tr(page)}</h1>
            </div>
          </div>
          <button className="today-btn" type="button" onClick={() => setLang(lang === "uz" ? "ru" : "uz")} aria-label={tr("Tilni almashtirish")}>{lang === "uz" ? "🇺🇿 UZ" : "🇷🇺 RU"}</button>
          <button className="profile-chip" onClick={() => setPage("Profil")} aria-label={tr("Profilni ochish")}>
            <span className="avatar">H</span>
            <span className="profile-name">{tr("Mening hisobim")}</span>
            <MoreHorizontal size={17} />
          </button>
        </header>

        {announcement && !announcementHidden && <section role="status" className="stat-card" style={{margin:"12px 16px", border:"1px solid var(--accent, #64748b)"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><strong>📢 {announcement.title}</strong><p style={{whiteSpace:"pre-wrap",marginTop:8}}>{announcement.message}</p></div><button className="icon-btn" aria-label={tr("E'lonni yopish")} onClick={() => setAnnouncementHidden(true)}><X size={18}/></button></div>
        </section>}
        {page === "AI" && <AiAdvisor />}

        {/* ==================== ASOSIY ==================== */}
        {page === "Asosiy" && <>
          <div className="month-row">
            <button className="icon-btn" aria-label={tr("Oldingi oy")} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
            <div className="month-title">{monthLabel(month, lang)}</div>
            <button className="icon-btn" aria-label={tr("Keyingi oy")} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
            <button className="today-btn" onClick={() => setMonth(new Date())}>{tr("Joriy oy")}</button>
          </div>

          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-label">
                <span className="stat-icon" style={{ background: "var(--income-soft)", color: "var(--income)" }}><TrendingUp size={17} /></span>
                {tr("Jami tushum")}
              </div>
              <div className="stat-value income">{fmt(summary.income)}</div>
              <div className="stat-note">{tr("Shu oyda kelib tushgan")}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">
                <span className="stat-icon" style={{ background: "var(--expense-soft)", color: "var(--expense)" }}><TrendingDown size={17} /></span>
                {tr("Jami xarajat")}
              </div>
              <div className="stat-value expense">{fmt(summary.expenses)}</div>
              <div className="stat-note">{tr("Shu oyda sarflangan")}</div>
            </article>
            <article className="stat-card">
              <div className="stat-label">
                <span className="stat-icon" style={{ background: "var(--surface-strong)", color: "var(--ink)" }}><Wallet size={17} /></span>
                {tr("Oylik farq")}
              </div>
              <div className={`stat-value ${summary.difference < 0 ? "expense" : "balance"}`}>{summary.difference > 0 ? "+" : ""}{fmt(summary.difference)}</div>
              <div className="stat-note">{tr("Tushum minus xarajat")}</div>
            </article>
          </section>

          <div className="actions">
            <button className="primary-action" onClick={() => openForm("EXPENSE")}><Plus size={18} /> {tr("Xarajat")}</button>
            <button className="secondary-action" onClick={() => openForm("INCOME")}><ArrowDownLeft size={18} /> {tr("Tushum")}</button>
          </div>

          <section className="content-grid">
            <article className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">{tr("So'nggi operatsiyalar")}</div>
                  <div className="panel-subtitle">{monthRows.length ? tr("{n} ta tranzaksiya", { n: monthRows.length }) : tr("Tanlangan oy bo'yicha")}</div>
                </div>
                <button className="text-button" onClick={() => setPage("Hisobot")}>{tr("Barchasi")} <ArrowRight size={13} style={{ display: "inline", verticalAlign: "middle" }} /></button>
              </div>
              {monthRows.length ? <div className="transaction-list">
                {monthRows.slice(0, 6).map(t => {
                  const cat = categories.find(c => c.id === t.categoryId);
                  return <div className="transaction" key={t.id}>
                    <div className="tx-icon">{categoryIcon(cat?.name ?? "Boshqa")}</div>
                    <div className="tx-info">
                      <div className="tx-name">{cat ? catLabel(cat.name) : tr("Kategoriya")}</div>
                      <div className="tx-meta">{dShort(t.occurredAt)}{t.note ? ` · ${t.note}` : ""}</div>
                    </div>
                    <div className={`tx-amount ${t.type === "INCOME" ? "income" : "expense"}`}>{t.type === "INCOME" ? "+" : "−"}{fmt(t.amount)}</div>
                    <button className="icon-btn" aria-label={tr("Tahrirlash")} onClick={() => editTransaction(t)}><Pencil size={14} /></button>
                  </div>;
                })}
              </div> : <div className="empty-state">
                <div className="empty-icon"><Receipt size={22} /></div>
                <div className="empty-title">{tr("Hozircha operatsiyalar yo'q")}</div>
                <div className="empty-copy">{tr("Birinchi tushum yoki xarajatingizni kiriting.")}</div>
              </div>}
            </article>

            <div className="page-stack">
              <article className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">{tr("Bugungi xarajat")}</div>
                    <div className="panel-subtitle">{tr("Faqat bugungi kun")}</div>
                  </div>
                  <span className="stat-icon" style={{ background: "var(--expense-soft)", color: "var(--expense)" }}><Receipt size={17} /></span>
                </div>
                <div className="spend-total">{fmt(todayExpense)}</div>
                <div className="stat-note">{tr("Bugun qayd etilgan jami xarajat")}</div>
              </article>

              <article className="panel">
                <div className="panel-head">
                  <div>
                    <div className="panel-title">{tr("Xarajatlar tarkibi")}</div>
                    <div className="panel-subtitle">{tr("Eng ko'p sarflangan yo'nalishlar")}</div>
                  </div>
                </div>
                {categoryTotals.length ? categoryTotals.slice(0, 4).map(c =>
                  <div key={c.id} style={{ marginBottom: 15 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 7 }}>
                      <span style={{ color: "var(--muted)" }}>{catLabel(c.name)}</span>
                      <strong>{fmt(c.total)}</strong>
                    </div>
                    <div className="progress-track" style={{ margin: "0", height: 5 }}>
                      <div className="progress-fill" style={{ width: `${Math.min(100, c.total / Math.max(...categoryTotals.map(x => x.total)) * 100)}%`, background: c.color }} />
                    </div>
                  </div>
                ) : <div className="empty-state" style={{ padding: "12px 0" }}>
                  <div className="empty-copy">{tr("Xarajat qo'shilgach, tahlil shu yerda ko'rinadi.")}</div>
                </div>}
              </article>
            </div>
          </section>
        </>}

        {/* ==================== HISOBOT ==================== */}
        {page === "Hisobot" && <div className="page-stack">
          <div className="month-row">
            <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
            <div className="month-title">{monthLabel(month, lang)}</div>
            <button className="icon-btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
            <button className="today-btn" onClick={() => setMonth(new Date())}>{tr("Joriy oy")}</button>
          </div>
          <div className="section-tabs">
            <button className={`section-tab ${reportTab === "Oylik statistika" ? "active" : ""}`} onClick={() => setReportTab("Oylik statistika")}>{tr("Oylik statistika")}</button>
            <button className={`section-tab ${reportTab === "Kalendar" ? "active" : ""}`} onClick={() => setReportTab("Kalendar")}>{tr("Kalendar")}</button>
          </div>

          {reportTab === "Oylik statistika" ? <>
            <div className="report-cards">
              <div className="report-small"><span>{tr("Tushum")}</span><strong className="income">{fmt(summary.income)}</strong></div>
              <div className="report-small"><span>{tr("Xarajat")}</span><strong className="expense">{fmt(summary.expenses)}</strong></div>
              <div className="report-small"><span>{tr("Oylik farq")}</span><strong>{fmt(summary.difference)}</strong></div>
            </div>

            <article className="panel">
              <div className="panel-head">
                <div>
                  <div className="panel-title">{tr("Kategoriyalar bo'yicha xarajat")}</div>
                  <div className="panel-subtitle">{tr("Vizual taqsimot va foizlar")}</div>
                </div>
              </div>
              <DonutChart data={donutData} total={donutTotal} />
            </article>

            <div className="content-grid">
              <article className="panel">
                <div className="panel-title">{tr("Batafsil ro'yxat")}</div>
                <div style={{ marginTop: 16 }}>
                  {categoryTotals.length ? categoryTotals.map(c =>
                    <div key={c.id} style={{ marginBottom: 18 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="legend-dot" style={{ background: c.color }} />
                          {catLabel(c.name)}
                        </span>
                        <strong>{fmt(c.total)}</strong>
                      </div>
                      <div className="progress-track" style={{ margin: 0 }}>
                        <div className="progress-fill" style={{ width: `${c.total / Math.max(...categoryTotals.map(x => x.total)) * 100}%`, background: c.color }} />
                      </div>
                    </div>
                  ) : <div className="empty-state">{tr("Statistika uchun ma'lumot yetarli emas.")}</div>}
                </div>
              </article>

              <article className="panel">
                <div className="panel-title">{tr("Oylik ko'rsatkichlar")}</div>
                <div className="profile-row">
                  <div className="row-copy"><strong>{tr("Kunlik o'rtacha xarajat")}</strong><p>{tr("Shu oy bo'yicha")}</p></div>
                  <b>{fmt(summary.expenses / Math.max(1, new Date().getDate()))}</b>
                </div>
                <div className="profile-row">
                  <div className="row-copy"><strong>{tr("Eng katta xarajat")}</strong><p>{tr("Bir operatsiya")}</p></div>
                  <b>{fmt(Math.max(0, ...summary.transactions.filter(t => t.type === "EXPENSE").map(t => t.amount)))}</b>
                </div>
                <div className="profile-row">
                  <div className="row-copy"><strong>{tr("Tranzaksiyalar")}</strong><p>{tr("Jami qaydlar")}</p></div>
                  <b>{summary.transactions.length}</b>
                </div>
              </article>
            </div>
          </> : <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">{tr("Kunlik kalendar")}</div>
                <div className="panel-subtitle">{tr("Sanani tanlab, o'sha kundagi operatsiyalarni ko'ring")}</div>
              </div>
            </div>
            <div className="calendar-grid">
              {["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"].map(d => <div className="calendar-weekday" key={d}>{tr(d)}</div>)}
              {Array.from({ length: days.offset }, (_, i) => <div key={`blank${i}`} className="calendar-day empty" />)}
              {calendarRows.map(d => {
                const dayRows = transactions.filter(t => localDateKey(new Date(t.occurredAt)) === localDateKey(d));
                return <button key={d.toISOString()} className={`calendar-day ${localDateKey(d) === localDateKey(selectedDate) ? "selected" : ""} ${dayRows.length ? "has-tx" : ""}`} onClick={() => setSelectedDate(d)}>{d.getDate()}</button>;
              })}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", marginTop: 20, paddingTop: 18 }}>
              <div className="panel-head">
                <div>
                  <div className="panel-title">{dLong(selectedDate)}</div>
                  <div className="panel-subtitle">{tr("Kunlik moliyaviy natija")}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="primary-action" style={{ flex: "0 0 auto", padding: "10px 14px", fontSize: 12 }} onClick={() => openForm("EXPENSE", selectedDate)}>
                    <Plus size={14} /> {tr("Xarajat")}
                  </button>
                  <button className="secondary-action" style={{ flex: "0 0 auto", padding: "10px 14px", fontSize: 12 }} onClick={() => openForm("INCOME", selectedDate)}>
                    <ArrowDownLeft size={14} /> {tr("Tushum")}
                  </button>
                </div>
              </div>
              <div className="report-cards">
                <div className="report-small"><span>{tr("Tushum")}</span><strong className="income">{fmt(daily.income)}</strong></div>
                <div className="report-small"><span>{tr("Xarajat")}</span><strong className="expense">{fmt(daily.expenses)}</strong></div>
                <div className="report-small"><span>{tr("Farq")}</span><strong>{fmt(daily.difference)}</strong></div>
              </div>
              {daily.transactions.length ? daily.transactions.map(t =>
                <div className="transaction" key={t.id}>
                  <div className="tx-icon">{categoryIcon(categories.find(c => c.id === t.categoryId)?.name ?? "")}</div>
                  <div className="tx-info">
                    <div className="tx-name">{(() => { const c = categories.find(x => x.id === t.categoryId); return c ? catLabel(c.name) : ""; })()}</div>
                    <div className="tx-meta">{t.note || tr("Izoh yo'q")}</div>
                  </div>
                  <div className={`tx-amount ${t.type === "INCOME" ? "income" : "expense"}`}>{t.type === "INCOME" ? "+" : "−"}{fmt(t.amount)}</div>
                  <button className="icon-btn" onClick={() => editTransaction(t)} aria-label={tr("Tahrirlash")}><Pencil size={14} /></button>
                  <button className="icon-btn" onClick={() => removeTransaction(t.id)} aria-label={tr("O'chirish")}><Trash2 size={14} /></button>
                </div>
              ) : <div className="empty-state"><div className="empty-copy">{tr("Bu sana uchun operatsiyalar yo'q.")}</div></div>}
            </div>
          </div>}
        </div>}

        {/* ==================== QARZLAR ==================== */}
        {page === "Qarzlar" && <div className="page-stack">
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">{tr("Qarzlar nazorati")}</div>
                <div className="panel-subtitle">{tr("Qarzlar oddiy tushum va xarajatlardan alohida yuritiladi")}</div>
              </div>
              <button className="primary-action" style={{ flex: "0 0 auto", padding: "11px 14px" }} onClick={() => openForm("DEBT")}><Plus size={16} /> {tr("Qarz qo'shish")}</button>
            </div>
            <div className="section-tabs">
              <button className={`section-tab ${debtTab === "LENT" ? "active" : ""}`} onClick={() => setDebtTab("LENT")}>{tr("Men bergan qarzlar")}</button>
              <button className={`section-tab ${debtTab === "BORROWED" ? "active" : ""}`} onClick={() => setDebtTab("BORROWED")}>{tr("Men olgan qarzlar")}</button>
            </div>

            {debtRows.length ? debtRows.map(d => {
              const remain = debtRemaining(d.originalAmount, d.repayments);
              const pct = d.originalAmount ? (remain.paid / d.originalAmount) * 100 : 0;
              const dates = d.repaymentDates ?? [];
              return <div className="debt-card" key={d.id}>
                <div className="debt-head">
                  <div className="debt-mark"><HandCoins size={19} /></div>
                  <div className="debt-detail">
                    <div className="debt-name">{d.personName}</div>
                    <div className="debt-meta">{new Date(d.occurredAt).toLocaleDateString(locale)} · {tr("Boshlang'ich")}: {fmt(d.originalAmount)}</div>
                    <span className={`status-pill ${remain.remaining === 0 ? "paid" : remain.paid > 0 ? "partial" : ""}`}>
                      {remain.remaining === 0 ? tr("To'liq yopilgan") : remain.paid > 0 ? tr("Qisman qaytarilgan") : tr("Ochiq qarz")}
                    </span>
                  </div>
                  <div className="debt-remaining">
                    {fmt(remain.remaining)}
                    <small>{tr("Qoldiq")}</small>
                  </div>
                </div>

                <div className="debt-progress">
                  <div className="debt-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>

                {d.repayments.length > 0 && (
                  <div className="debt-history">
                    <div className="debt-history-title"><History size={12} /> {tr("To'lovlar tarixi")} ({d.repayments.length})</div>
                    {d.repayments.map((amt, i) => (
                      <div className="debt-history-item" key={i}>
                        <span className="debt-history-date">
                          {dates[i] ? new Date(dates[i]).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : `${tr("To'lov")} ${i + 1}`}
                        </span>
                        <span className="debt-history-amt">+{fmt(amt)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {remain.remaining > 0 && (
                  <div className="debt-actions">
                    <button className="text-button" onClick={() => { setRepayDebtId(d.id); setRepayAmount(""); setError(""); setSubmitting(false); setModal("REPAY"); }}>
                      <Plus size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                      {tr("To'lov kiritish")}
                    </button>
                  </div>
                )}
              </div>;
            }) : <div className="empty-state">
              <div className="empty-icon"><HandCoins size={22} /></div>
              <div className="empty-title">{tr("Hozircha qarzlar yo'q")}</div>
              <div className="empty-copy">{tr("Bergan yoki olgan qarzingizni qayd eting.")}</div>
              <button className="text-button" style={{ marginTop: 12 }} onClick={() => openForm("DEBT")}>+ {tr("Qarz qo'shish")}</button>
            </div>}
          </div>
        </div>}

        {/* ==================== PROFIL ==================== */}
        {page === "Profil" && <div className="page-stack">
          <div className="panel">
            <div className="panel-head">
              <div>
                <div className="panel-title">{tr("Profil va sozlamalar")}</div>
                <div className="panel-subtitle">{tr("Hisobingiz va ma'lumotlaringizni boshqaring")}</div>
              </div>
              <span className="stat-icon" style={{ background: "var(--surface-strong)", color: "var(--accent-2)" }}><Settings2 size={18} /></span>
            </div>
            <div className="notice">
              <ShieldCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
              {tr("Ma'lumotlar ushbu qurilmada saqlanadi. Telegram va PostgreSQL bilan sinxronlash uchun server sozlamalari kerak.")}
            </div>

            {onSwitchToAdmin && (
              <button className="form-submit" style={{ marginBottom: 16 }} onClick={onSwitchToAdmin}>
                <ShieldCheck size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />
                {tr("Admin panelga qaytish")}
              </button>
            )}

            <div className="profile-row">
              <span className="stat-icon" style={{ background: "var(--surface-strong)", color: "var(--ink)" }}><UserRound size={18} /></span>
              <div className="row-copy">
                <strong>{tr("Foydalanuvchi")}</strong>
                <p>{tr("Mahalliy sinov profili")}</p>
              </div>
              <span className="status-pill">{tr("Demo")}</span>
            </div>
            <div className="profile-row">
              <span className="stat-icon" style={{ background: "var(--surface-strong)", color: "var(--ink)" }}><ListPlus size={18} /></span>
              <div className="row-copy">
                <strong>{tr("Kategoriyalar")}</strong>
                <p>{tr("Daromad va xarajat turlarini boshqaring")}</p>
              </div>
              <button className="text-button" onClick={() => openForm("CATEGORY")}>{tr("Qo'shish")}</button>
            </div>
            <div className="profile-row">
              <span className="stat-icon" style={{ background: "var(--surface-strong)", color: "var(--ink)" }}><Languages size={18} /></span>
              <div className="row-copy">
                <strong>{tr("Til")}</strong>
                <p>{tr("Ilova va bot tilini tanlang")}</p>
              </div>
              <div className="section-tabs" style={{ margin: 0 }}>
                <button className={`section-tab ${lang === "uz" ? "active" : ""}`} onClick={() => setLang("uz")}>🇺🇿 O'zbekcha</button>
                <button className={`section-tab ${lang === "ru" ? "active" : ""}`} onClick={() => setLang("ru")}>🇷🇺 Русский</button>
              </div>
            </div>
            <div className="profile-row">
              <span className="stat-icon" style={{ background: "var(--surface-strong)", color: "var(--ink)" }}><CircleHelp size={18} /></span>
              <div className="row-copy">
                <strong>{tr("Maxfiylik")}</strong>
                <p>{tr("Ma'lumotlaringizni boshqa foydalanuvchi bilan ulashmang.")}</p>
              </div>
            </div>
            <div className="profile-row">
              <span className="stat-icon" style={{ background: "var(--surface-strong)", color: "var(--ink)" }}><Trash2 size={18} /></span>
              <div className="row-copy">
                <strong>{tr("Mahalliy ma'lumotlarni tozalash")}</strong>
                <p>{tr("Bu amal qaytarilmaydi.")}</p>
              </div>
              <button className="danger-button" onClick={() => { if (confirm(tr("Barcha mahalliy ma'lumotlar o'chirilsinmi?"))) { setTransactions([]); setDebts([]); setCategories(defaultCategories); showNotice("Mahalliy ma'lumotlar tozalandi"); } }}>{tr("Tozalash")}</button>
            </div>
          </div>
        </div>}
      </main>

      {/* ==================== BOTTOM NAV ==================== */}
      <nav className="bottom-nav" aria-label={tr("Asosiy navigatsiya")}>
        <div className="nav-inner">
          {nav.map(n => {
            const Icon = n.icon;
            return <button key={n.name} className={`nav-item ${page === n.name ? "active" : ""}`} onClick={() => setPage(n.name)}>
              <Icon size={20} strokeWidth={page === n.name ? 2.4 : 1.8} />
              {tr(n.name)}
            </button>;
          })}
        </div>
      </nav>

      {/* ==================== TOAST ==================== */}
      {notice && <div className="toast" role="status" aria-live="polite">
        <Check size={15} />{tr(notice)}
      </div>}

      {/* ==================== MODAL ==================== */}
      {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null); }}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-head">
            <div className="modal-title" id="modal-title">
              {tr(modal === "EXPENSE" ? "Xarajat qo'shish"
                : modal === "INCOME" ? "Tushum qo'shish"
                : modal === "EDIT" ? "Tranzaksiyani tahrirlash"
                : modal === "DEBT" ? "Qarz qo'shish"
                : modal === "CATEGORY" ? "Kategoriya qo'shish"
                : "Qaytarilgan to'lov")}
            </div>
            <button className="close-btn" onClick={() => setModal(null)} aria-label={tr("Yopish")}><X size={18} /></button>
          </div>
          {(modal === "EXPENSE" || modal === "INCOME" || modal === "EDIT") && (
            <div className="modal-subtitle">
              {tr("Sana")}: {dLong(new Date(date + "T12:00:00"))}
            </div>
          )}

          {/* === EXPENSE / INCOME / EDIT === */}
          {(modal === "EXPENSE" || modal === "INCOME" || modal === "EDIT") && <form onSubmit={saveTransaction}>
            <div className="field">
              <label htmlFor="amount">{tr("Summa (so'm)")}</label>
              <input ref={amountInputRef} id="amount" className="amount-input" type="number" min="1" step="1" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" inputMode="numeric" />
            </div>
            <div className="field">
              <label htmlFor="category">{tr("Kategoriya")}</label>
              <select id="category" value={categoryId} onChange={e => { setCategoryId(e.target.value); const c = categories.find(x => x.id === e.target.value); if (c) setType(c.type); }} required>
                {categories.filter(c => c.type === type).map(c => <option key={c.id} value={c.id}>{catLabel(c.name)}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="note">{tr("Izoh (ixtiyoriy)")}</label>
              <input id="note" value={note} onChange={e => setNote(e.target.value)} maxLength={500} placeholder={tr("Masalan, tushlik yoki yo'l kira")} />
            </div>
            {error && <div className="form-error">{errText(error)}</div>}
            <button className="form-submit" type="submit" disabled={submitting}>
              {submitting ? tr("Saqlanmoqda...") : modal === "EDIT" ? tr("O'zgarishlarni saqlash") : type === "INCOME" ? tr("Tushumni saqlash") : tr("Xarajatni saqlash")}
            </button>
            {modal === "EDIT" && <button type="button" className="danger-button" style={{ width: "100%", marginTop: 10, padding: 12 }} onClick={() => { if (editId) removeTransaction(editId); setModal(null); }}>{tr("Tranzaksiyani o'chirish")}</button>}
          </form>}

          {/* === DEBT === */}
          {modal === "DEBT" && <form onSubmit={saveDebt}>
            <div className="field">
              <label htmlFor="person">{tr("Shaxs ismi")}</label>
              <input id="person" required value={person} onChange={e => setPerson(e.target.value)} placeholder={tr("Masalan, Azizbek")} />
            </div>
            <div className="field">
              <label htmlFor="direction">{tr("Qarz turi")}</label>
              <select id="direction" value={direction} onChange={e => setDirection(e.target.value as "LENT" | "BORROWED")}>
                <option value="LENT">{tr("Men bergan qarz")}</option>
                <option value="BORROWED">{tr("Men olgan qarz")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="debt-amount">{tr("Summa (so'm)")}</label>
              <input id="debt-amount" className="amount-input" type="number" min="1" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" inputMode="numeric" />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="debt-date">{tr("Sana")}</label>
                <input id="debt-date" type="date" required value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="due-date">{tr("Qaytarish sanasi")}</label>
                <input id="due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="debt-note">{tr("Izoh (ixtiyoriy)")}</label>
              <input id="debt-note" value={note} onChange={e => setNote(e.target.value)} placeholder={tr("Qo'shimcha ma'lumot")} />
            </div>
            {error && <div className="form-error">{errText(error)}</div>}
            <button className="form-submit" disabled={submitting}>{submitting ? tr("Saqlanmoqda...") : tr("Qarzni saqlash")}</button>
          </form>}

          {/* === CATEGORY === */}
          {modal === "CATEGORY" && <form onSubmit={saveCategory}>
            <div className="field">
              <label htmlFor="cat-type">{tr("Kategoriya turi")}</label>
              <select id="cat-type" value={type} onChange={e => setType(e.target.value as "INCOME" | "EXPENSE")}>
                <option value="EXPENSE">{tr("Xarajat")}</option>
                <option value="INCOME">{tr("Tushum")}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="cat-name">{tr("Kategoriya nomi")}</label>
              <input id="cat-name" value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder={tr("Yangi kategoriya")} maxLength={60} />
            </div>
            {error && <div className="form-error">{errText(error)}</div>}
            <button className="form-submit">{tr("Kategoriya qo'shish")}</button>
          </form>}

          {/* === REPAY === */}
          {modal === "REPAY" && <form onSubmit={saveRepayment}>
            <div className="field">
              <label htmlFor="repay">{tr("Qaytarilgan summa (so'm)")}</label>
              <input ref={amountInputRef} id="repay" type="number" min="1" step="1" required value={repayAmount} onChange={e => setRepayAmount(e.target.value)} placeholder="0" inputMode="numeric" className="amount-input" />
            </div>
            {error && <div className="form-error">{errText(error)}</div>}
            <button className="form-submit" disabled={submitting}>{submitting ? tr("Saqlanmoqda...") : tr("To'lovni saqlash")}</button>
          </form>}
        </section>
      </div>}
    </>
  );
}