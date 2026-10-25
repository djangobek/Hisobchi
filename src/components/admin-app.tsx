"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Users, TrendingUp, TrendingDown, Activity,
  Search, ChevronLeft, ChevronRight, Send, Wrench, X,
  MessageSquare, Megaphone, History, Ban, ShieldCheck, Bot,
  ArrowLeft, LayoutDashboard, Radio, UserCircle, CheckCircle2,
  AlertCircle, RefreshCw, MoreVertical, Eye, EyeOff, Server,
} from "lucide-react";
import { formatUZS } from "@/lib/currency";

const AdminChart = dynamic(() => import("./admin-chart"), { ssr: false, loading: () => <div className="admin-empty">Grafik yuklanmoqda...</div> });

/* ============ TYPES ============ */
type Stats = {
  users: { total: number; activeWeek: number; activeMonth: number; blocked: number; blockedBot: number };
  transactions: { total: number; income: number; expense: number; net: number; income30: number; expense30: number };
  debts: { total: number; open: number };
  recentUsers: any[];
  topCategories: any[];
  daily: { day: string; income: number; expense: number }[];
  topUsers: { id: string; name: string; income: number; expense: number; count: number }[];
  computedAt: string;
};

type AdminUser = {
  id: string; telegramId: string; firstName: string | null; lastName: string | null;
  username: string | null; role: string; isBlocked: boolean; blockedBot: boolean;
  lastActiveAt: string; createdAt: string; _count: { transactions: number; debts: number };
  finance?: { income: number; expense: number };
};

type Tab = "overview" | "users" | "broadcast" | "announcements" | "maintenance" | "audit" | "health";

/* ============ HELPERS ============ */
const tgInitData = () => {
  if (typeof window === "undefined") return "";
  return (window as any)?.Telegram?.WebApp?.initData ?? "";
};

const apiFetch = (url: string, opts: RequestInit = {}) => {
  const headers = new Headers(opts.headers ?? {});
  headers.set("x-telegram-init-data", tgInitData());
  headers.set("Content-Type", "application/json");
  return fetch(url, { ...opts, headers });
};

/* ============ MAIN ============ */
export default function AdminApp({ onSwitchToUser }: { onSwitchToUser: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedUserFinance, setSelectedUserFinance] = useState<any>(null);

  const showToast = useCallback((m: string, type: "success" | "error" = "success") => {
    setToast(m);
    setToastType(type);
    window.setTimeout(() => setToast(""), 2600);
  }, []);

  const statsAbort = useRef<AbortController | null>(null);
  const loadStats = useCallback(async (opts: { silent?: boolean; force?: boolean } = {}) => {
    statsAbort.current?.abort();
    const ac = new AbortController();
    statsAbort.current = ac;
    if (!opts.silent) setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/stats${opts.force ? "?refresh=1" : ""}`, { signal: ac.signal });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStats(data);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  // Qidiruvda har harfga so'rov ketmasligi uchun 350ms debounce
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => { const t = window.setTimeout(() => setDebouncedQuery(query), 350); return () => window.clearTimeout(t); }, [query]);
  const [sort, setSort] = useState("recent");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: debouncedQuery, filter, sort, page: String(page), limit: "20" });
      const res = await apiFetch(`/api/admin/users?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setUsers(data.users);
      setPages(data.pages);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filter, sort, page]);

  useEffect(() => { loadStats(); }, [loadStats]);
  // Visibility-aware polling: faqat "Umumiy" tabda va sahifa ko'rinib turganda, 60s da bir marta.
  useEffect(() => {
    if (tab !== "overview") return;
    const tick = () => { if (document.visibilityState === "visible") void loadStats({ silent: true }); };
    const id = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [tab, loadStats]);

  const exportCsv = async () => {
    try {
      const res = await apiFetch("/api/admin/export");
      if (!res.ok) throw new Error((await res.json()).error ?? "Eksport xatosi");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast("CSV tayyor");
    } catch (e) { showToast(e instanceof Error ? e.message : "Xatolik", "error"); }
  };
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openUser = async (id: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/users/${id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSelectedUser(data.user);
      setSelectedUserFinance(data);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setLoading(false);
    }
  };

  const goToBot = () => {
    const url = process.env.NEXT_PUBLIC_BOT_URL || "https://t.me/your_bot";
    if ((window as any).Telegram?.WebApp?.close) {
      (window as any).Telegram.WebApp.close();
    } else {
      window.open(url, "_blank");
    }
  };

  const tabs: { id: Tab; label: string; short: string; icon: any }[] = [
    { id: "overview", label: "Umumiy", short: "Umumiy", icon: LayoutDashboard },
    { id: "users", label: "Foydalanuvchilar", short: "Users", icon: Users },
    { id: "broadcast", label: "Xabar yuborish", short: "Xabar", icon: Megaphone },
    { id: "announcements", label: "Web App e’loni", short: "E’lon", icon: MessageSquare },
    { id: "maintenance", label: "Texnik xizmat", short: "Texnik", icon: Wrench },
    { id: "audit", label: "Audit log", short: "Audit", icon: History },
    { id: "health", label: "Server holati", short: "Server", icon: Server },
  ];

  return (
    <div className="admin-shell">
      {/* ============ HEADER ============ */}
      <header className="admin-header">
        <div className="admin-brand">
          <div className="admin-brand-mark"><ShieldCheck size={22} /></div>
          <div>
            <div className="admin-eyebrow">ADMIN</div>
            <div className="admin-title">Boshqaruv</div>
          </div>
        </div>
        <div className="admin-header-actions">
          <button className="admin-pill-btn" onClick={onSwitchToUser}>
            <UserCircle size={15} />
            <span className="admin-pill-text">User rejimi</span>
          </button>
          <button className="admin-pill-btn primary" onClick={goToBot}>
            <Bot size={15} />
            <span className="admin-pill-text">Bot</span>
          </button>
        </div>
      </header>

      {/* ============ TABS (horizontal scroll on mobile) ============ */}
      <div className="admin-tabs-scroll">
        <div className="admin-tabs">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`admin-tab ${tab === t.id ? "active" : ""}`}
                onClick={() => setTab(t.id)}
              >
                <Icon size={16} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ CONTENT ============ */}
      <div className="admin-content">
        {tab === "overview" && <OverviewTab stats={stats} loading={loading} onRefresh={() => loadStats({ force: true })} />}
        {tab === "users" && (
          <UsersTab
            users={users}
            loading={loading}
            query={query}
            setQuery={setQuery}
            filter={filter}
            setFilter={setFilter}
            page={page}
            pages={pages}
            setPage={setPage}
            sort={sort}
            setSort={setSort}
            onExport={exportCsv}
            onOpenUser={openUser}
          />
        )}
        {tab === "broadcast" && <BroadcastPanel onToast={showToast} />}
        {tab === "announcements" && <AnnouncementPanel onToast={showToast} />}
        {tab === "maintenance" && <MaintenancePanel onToast={showToast} />}
        {tab === "audit" && <AuditPanel />}
        {tab === "health" && <ServerHealthPanel onToast={showToast} />}
      </div>

      {/* ============ USER DRAWER ============ */}
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          finance={selectedUserFinance?.finance}
          transactions={selectedUserFinance?.transactions ?? []}
          debts={selectedUserFinance?.debts ?? []}
          onClose={() => { setSelectedUser(null); setSelectedUserFinance(null); }}
          onToast={showToast}
          onRefresh={() => openUser(selectedUser.id)}
        />
      )}

      {/* ============ TOAST ============ */}
      {toast && (
        <div className={`admin-toast ${toastType === "error" ? "error" : ""}`}>
          {toastType === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast}
        </div>
      )}
    </div>
  );
}

/* ==================== OVERVIEW TAB ==================== */
function OverviewTab({ stats, loading, onRefresh }: { stats: Stats | null; loading: boolean; onRefresh: () => void }) {
  if (!stats) return <div className="admin-empty">Yuklanmoqda...</div>;

  return (
    <>
      <div className="admin-section-head">
        <div>
          <h2 className="admin-h2">Umumiy ko'rsatkichlar</h2>
          <p className="admin-sub">Platforma holati bir qarashda</p>
        </div>
        <button className="admin-icon-btn" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
      </div>

      <div className="admin-stats">
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple"><Activity size={18} /></div>
          <div className="admin-stat-body">
            <div className="admin-stat-label">Tranzaksiyalar</div>
            <div className="admin-stat-value">{stats.transactions.total}</div>
            <div className="admin-stat-meta">Qarzlar: {stats.debts.total} (ochiq: {stats.debts.open})</div>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head"><h3 className="admin-h3">Eng faol foydalanuvchilar</h3></div>
        <div className="admin-list">
          {stats.topUsers.map((u, i) => (
            <div className="admin-list-row" key={u.id}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {u.name} · {u.count}×</span>
              <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                <b style={{ color: "var(--income)" }}>+{formatUZS(u.income)}</b> <b style={{ color: "var(--expense)" }}>−{formatUZS(u.expense)}</b>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-grid-2">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h3 className="admin-h3">Platforma holati</h3>
          </div>
          <div className="admin-list">
            <div className="admin-list-row">
              <span>Admin bloklagan</span>
              <b style={{ color: "var(--expense)" }}>{stats.users.blocked}</b>
            </div>
            <div className="admin-list-row">
              <span>Botni bloklagan</span>
              <b style={{ color: "var(--expense)" }}>{stats.users.blockedBot}</b>
            </div>
            <div className="admin-list-row">
              <span>Aktiv (7 kun)</span>
              <b style={{ color: "var(--income)" }}>{stats.users.activeWeek}</b>
            </div>
            <div className="admin-list-row">
              <span>Ochiq qarzlar</span>
              <b style={{ color: "var(--accent-2)" }}>{stats.debts.open}</b>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h3 className="admin-h3">Yangi foydalanuvchilar</h3>
          </div>
          <div className="admin-list">
            {stats.recentUsers.map(u => (
              <div className="admin-list-row" key={u.id}>
                <div style={{ minWidth: 0, overflow: "hidden" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Noma'lum"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                    {new Date(u.createdAt).toLocaleDateString("uz-UZ")}
                  </div>
                </div>
                <span className={`admin-badge ${u.role === "ADMIN" ? "primary" : ""}`}>{u.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h3 className="admin-h3">Top kategoriyalar</h3>
        </div>
        <div className="admin-cats">
          {stats.topCategories.map((c, i) => (
            <div key={i} className="admin-cat-chip">
              <span className="admin-cat-dot" style={{ background: c.color }} />
              <span className="admin-cat-name">{c.name}</span>
              <span className="admin-cat-count">{c._count.transactions}×</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ==================== USERS TAB ==================== */
function UsersTab({ users, loading, query, setQuery, filter, setFilter, page, pages, setPage, onOpenUser, sort, setSort, onExport }: any) {
  return (
    <>
      <div className="admin-section-head">
        <div>
          <h2 className="admin-h2">Foydalanuvchilar</h2>
          <p className="admin-sub">Qidiruv, filtr va har bir foydalanuvchi tushum/xarajati</p>
        </div>
        <button className="admin-pill-btn" onClick={onExport}>CSV</button>
      </div>

      <div className="admin-search">
        <Search size={16} className="admin-search-icon" />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setPage(1); }}
          placeholder="Ism, username yoki Telegram ID..."
          className="admin-search-input"
        />
      </div>

      <div className="admin-filters">
        {[
          { id: "all", label: "Barcha" },
          { id: "active", label: "Aktiv" },
          { id: "inactive", label: "Nofaol" },
          { id: "blocked", label: "Bloklangan" },
          { id: "admins", label: "Adminlar" },
        ].map(f => (
          <button
            key={f.id}
            className={`admin-chip ${filter === f.id ? "active" : ""}`}
            onClick={() => { setFilter(f.id); setPage(1); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="admin-filters">
        {[{ id: "recent", label: "Oxirgi faol" }, { id: "new", label: "Yangi" }, { id: "volume", label: "Aylanma ↓" }].map(f => (
          <button key={f.id} className={`admin-chip ${sort === f.id ? "active" : ""}`} onClick={() => { setSort(f.id); setPage(1); }}>{f.label}</button>
        ))}
      </div>

      {loading && users.length === 0 ? (
        <div className="admin-empty">Yuklanmoqda...</div>
      ) : users.length === 0 ? (
        <div className="admin-empty">Topilmadi.</div>
      ) : (
        <>
          <div className="admin-user-list">
            {users.map((u: AdminUser) => (
              <button key={u.id} className="admin-user-card" onClick={() => onOpenUser(u.id)}>
                <div className={`admin-user-avatar ${u.role === "ADMIN" ? "admin" : ""}`}>
                  {u.role === "ADMIN" ? <ShieldCheck size={18} /> : <Users size={18} />}
                </div>
                <div className="admin-user-info">
                  <div className="admin-user-name">
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "Noma'lum"}
                    {u.isBlocked && <span className="admin-badge danger">Bloklangan</span>}
                    {u.blockedBot && <span className="admin-badge warning">Bot blok</span>}
                  </div>
                  <div className="admin-user-meta">
                    @{u.username ?? "—"} · ID: {u.telegramId} · {u._count.transactions} tranzaksiya
                  </div>
                  <div className="admin-user-meta">
                    <span style={{ color: "var(--income)" }}>+{formatUZS(u.finance?.income ?? 0)}</span>{" "}
                    <span style={{ color: "var(--expense)" }}>−{formatUZS(u.finance?.expense ?? 0)}</span>
                  </div>
                </div>
                <div className="admin-user-right">
                  <div className="admin-user-date">
                    {new Date(u.lastActiveAt).toLocaleDateString("uz-UZ")}
                  </div>
                  <div className="admin-user-status">Aktiv</div>
                </div>
              </button>
            ))}
          </div>

          <div className="admin-pagination">
            <button className="admin-icon-btn" disabled={page <= 1} onClick={() => setPage((p: number) => p - 1)}>
              <ChevronLeft size={16} />
            </button>
            <span className="admin-page-info">{page} / {pages}</span>
            <button className="admin-icon-btn" disabled={page >= pages} onClick={() => setPage((p: number) => p + 1)}>
              <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </>
  );
}

/* ==================== BROADCAST ==================== */
function AnnouncementPanel({ onToast }: { onToast: (m: string, t?: "success" | "error") => void }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let alive = true;
    void apiFetch("/api/announcement").then(async r => {
      if (!r.ok) return;
      const d = await r.json();
      if (alive && d) { setTitle(d.title ?? ""); setMessage(d.message ?? ""); setActive(Boolean(d.active)); }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const save = async () => {
    if (!title.trim() || !message.trim()) { onToast("Sarlavha va matnni kiriting", "error"); return; }
    setSaving(true);
    try {
      const r = await apiFetch("/api/announcement", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, message, active }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "E’lonni saqlab bo‘lmadi");
      onToast(active ? "E’lon barcha Web App foydalanuvchilariga chiqarildi" : "E’lon o‘chirildi", "success");
    } catch (e) { onToast(e instanceof Error ? e.message : "Xatolik", "error"); }
    finally { setSaving(false); }
  };
  return <section className="admin-panel">
    <div className="admin-section-heading"><div><h2>Web App e’loni</h2><p>Bu e’lon Mini App oynasida ko‘rinadi va foydalanuvchilar uni yopishi mumkin. O‘zgarishlar taxminan 1 daqiqada yangilanadi.</p></div></div>
    <label className="admin-field-label">Sarlavha</label><input className="admin-input" value={title} maxLength={160} onChange={e => setTitle(e.target.value)} placeholder="Masalan: Muhim yangilik" />
    <label className="admin-field-label">E’lon matni</label><textarea className="admin-textarea" value={message} maxLength={4000} onChange={e => setMessage(e.target.value)} rows={6} placeholder="Foydalanuvchilarga ko‘rinadigan xabar..." />
    <label className="admin-checkbox-row"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> E’lon faol</label>
    <button className="admin-button primary" disabled={saving} onClick={() => void save()}>{saving ? "Saqlanmoqda..." : "E’lonni saqlash"}</button>
  </section>;
}

function BroadcastPanel({ onToast }: { onToast: (m: string, t?: "success" | "error") => void }) {
  const [message, setMessage] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [segment, setSegment] = useState("all");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  const send = async () => {
    if (!message.trim()) { onToast("Xabar matni bo'sh", "error"); return; }
    if (!confirm("Barcha tanlangan foydalanuvchilarga yuborilsinmi?")) return;
    setSending(true);
    try {
      const res = await apiFetch("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({
          message: message.trim(),
          buttonText: buttonText.trim() || undefined,
          buttonUrl: buttonUrl.trim() || undefined,
          segment,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onToast(`✅ Yuborildi: ${data.sent} · Xato: ${data.failed}`);
      setMessage(""); setButtonText(""); setButtonUrl("");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="admin-section-head">
        <div>
          <h2 className="admin-h2">Xabar yuborish</h2>
          <p className="admin-sub">Segment bo'yicha ommaviy xabar</p>
        </div>
        <button className="admin-icon-btn" onClick={() => setPreview(!preview)} title="Ko'rinish">
          {preview ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <div className="admin-panel">
        <div className="admin-field">
          <label className="admin-label">Segment</label>
          <select className="admin-input" value={segment} onChange={e => setSegment(e.target.value)}>
            <option value="all">Barcha</option>
            <option value="active">Aktiv (7 kun)</option>
            <option value="inactive">Nofaol</option>
            <option value="blocked">Botni bloklagan</option>
          </select>
        </div>

        <div className="admin-field">
          <label className="admin-label">Xabar matni (HTML ruxsat)</label>
          <textarea
            className="admin-textarea"
            rows={6}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="<b>Salom!</b> Yangilanish haqida..."
          />
        </div>

        <div className="admin-form-row">
          <div className="admin-field">
            <label className="admin-label">Tugma matni</label>
            <input className="admin-input" value={buttonText} onChange={e => setButtonText(e.target.value)} placeholder="Ochish" maxLength={64} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Tugma URL</label>
            <input className="admin-input" type="url" value={buttonUrl} onChange={e => setButtonUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>

        {preview && message && (
          <div className="admin-preview">
            <div className="admin-preview-label">PREVIEW</div>
            <div className="admin-preview-bubble" dangerouslySetInnerHTML={{ __html: message }} />
            {buttonUrl && (
              <div className="admin-preview-btn">{buttonText || "Ochish"}</div>
            )}
          </div>
        )}

        <button className="admin-btn primary full" onClick={send} disabled={sending}>
          <Send size={16} />
          {sending ? "Yuborilmoqda..." : "Yuborish"}
        </button>
      </div>
    </>
  );
}

/* ==================== MAINTENANCE ==================== */
function MaintenancePanel({ onToast }: { onToast: (m: string, t?: "success" | "error") => void }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch("/api/admin/maintenance")
      .then(r => r.json())
      .then(d => { setEnabled(!!d.enabled); setMessage(d.message ?? ""); })
      .finally(() => setLoading(false));
  }, []);

  const save = async (newEnabled: boolean) => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/maintenance", {
        method: "POST",
        body: JSON.stringify({ enabled: newEnabled, message }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEnabled(newEnabled);
      onToast(newEnabled ? "🛠 Texnik rejim YOQILDI" : "✅ Texnik rejim O'CHIRILDI");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="admin-empty">Yuklanmoqda...</div>;

  return (
    <>
      <div className="admin-section-head">
        <div>
          <h2 className="admin-h2">Texnik xizmat</h2>
          <p className="admin-sub">Barcha userlarga banner</p>
        </div>
      </div>

      <div className={`admin-alert ${enabled ? "danger" : "success"}`}>
        <div className="admin-alert-icon">
          {enabled ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
        </div>
        <div>
          <div className="admin-alert-title">
            {enabled ? "Texnik rejim YOQILGAN" : "Texnik rejim O'CHIRILGAN"}
          </div>
          <div className="admin-alert-text">
            {enabled
              ? "Barcha foydalanuvchilar banner ko'rmoqda"
              : "Foydalanuvchilar normal ishlashi mumkin"}
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-field">
          <label className="admin-label">Banner matni</label>
          <textarea
            className="admin-textarea"
            rows={3}
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="🛠 Botda texnik ishlar ketmoqda. Tez orada qaytamiz!"
          />
        </div>

        <div className="admin-form-row">
          <button className="admin-btn primary" onClick={() => save(true)} disabled={enabled || saving}>
            <Wrench size={15} /> Yoqish
          </button>
          <button className="admin-btn danger" onClick={() => save(false)} disabled={!enabled || saving}>
            <CheckCircle2 size={15} /> O'chirish
          </button>
        </div>
      </div>
    </>
  );
}

/* ==================== AUDIT ==================== */
function AuditPanel() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/admin/audit")
      .then(r => r.json())
      .then(d => setLogs(d.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="admin-empty">Yuklanmoqda...</div>;
  if (!logs.length) return <div className="admin-empty">Audit log bo'sh.</div>;

  return (
    <>
      <div className="admin-section-head">
        <div>
          <h2 className="admin-h2">Audit log</h2>
          <p className="admin-sub">So'nggi 100 ta harakat</p>
        </div>
      </div>

      <div className="admin-panel">
        {logs.map(l => (
          <div className="admin-list-row" key={l.id}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{l.action}</div>
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                {l.target ? `Target: ${l.target} · ` : ""}
                {new Date(l.createdAt).toLocaleString("uz-UZ")}
              </div>
            </div>
            <History size={14} style={{ color: "var(--muted)" }} />
          </div>
        ))}
      </div>
    </>
  );
}

/* ==================== USER DRAWER ==================== */
function UserDrawer({ user, finance, transactions, debts, onClose, onToast, onRefresh }: any) {
  const [msg, setMsg] = useState("");
  const [btnText, setBtnText] = useState("");
  const [btnUrl, setBtnUrl] = useState("");
  const [sending, setSending] = useState(false);

  const sendMessage = async () => {
    if (!msg.trim()) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}/message`, {
        method: "POST",
        body: JSON.stringify({
          message: msg.trim(),
          buttonText: btnText.trim() || undefined,
          buttonUrl: btnUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onToast("✅ Xabar yuborildi");
      setMsg(""); setBtnText(""); setBtnUrl("");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Xatolik", "error");
    } finally {
      setSending(false);
    }
  };

  const toggleBlock = async () => {
    if (!confirm(user.isBlocked ? "Blokdan chiqarilsinmi?" : "Bloklansinmi?")) return;
    try {
      const res = await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isBlocked: !user.isBlocked }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onToast("✅ O'zgartirildi");
      onRefresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Xatolik", "error");
    }
  };

  return (
    <div className="admin-modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="admin-modal">
        <div className="admin-modal-head">
          <div>
            <div className="admin-h3">
              {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
              @{user.username ?? "—"} · ID: {user.telegramId} · {user.role}
            </div>
          </div>
          <button className="admin-icon-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {finance && (
          <div className="admin-stats-mini">
            <div className="admin-stat-mini">
              <div className="admin-stat-label">Tushum</div>
              <div className="admin-stat-value-sm" style={{ color: "var(--income)" }}>
                {formatUZS(finance.income)}
              </div>
            </div>
            <div className="admin-stat-mini">
              <div className="admin-stat-label">Xarajat</div>
              <div className="admin-stat-value-sm" style={{ color: "var(--expense)" }}>
                {formatUZS(finance.expense)}
              </div>
            </div>
            <div className="admin-stat-mini">
              <div className="admin-stat-label">Balans</div>
              <div className="admin-stat-value-sm">
                {formatUZS(finance.balance)}
              </div>
            </div>
          </div>
        )}

        <button
          className={`admin-btn full ${user.isBlocked ? "primary" : "danger"}`}
          onClick={toggleBlock}
          style={{ marginBottom: 20 }}
        >
          <Ban size={15} />
          {user.isBlocked ? "Blokdan chiqarish" : "Bloklash"}
        </button>

        <div className="admin-divider" />

        <div className="admin-h3" style={{ marginBottom: 12 }}>Shaxsiy xabar</div>
        <div className="admin-field">
          <textarea
            className="admin-textarea"
            rows={4}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Xabar matni (HTML)..."
          />
        </div>
        <div className="admin-form-row">
          <div className="admin-field">
            <label className="admin-label">Tugma matni</label>
            <input className="admin-input" value={btnText} onChange={e => setBtnText(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Tugma URL</label>
            <input className="admin-input" type="url" value={btnUrl} onChange={e => setBtnUrl(e.target.value)} />
          </div>
        </div>
        <button className="admin-btn primary full" onClick={sendMessage} disabled={sending}>
          <MessageSquare size={15} />
          {sending ? "Yuborilmoqda..." : "Yuborish"}
        </button>

        <div className="admin-divider" />

        <div className="admin-h3" style={{ marginBottom: 12 }}>
          Tranzaksiyalar ({transactions.length})
        </div>
        <div style={{ maxHeight: 240, overflow: "auto" }}>
          {transactions.slice(0, 20).map((t: any) => (
            <div className="admin-tx-row" key={t.id}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.category?.name ?? "—"}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {new Date(t.occurredAt).toLocaleDateString("uz-UZ")}
                </div>
              </div>
              <div style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: t.type === "INCOME" ? "var(--income)" : "var(--expense)",
                fontVariantNumeric: "tabular-nums",
              }}>
                {t.type === "INCOME" ? "+" : "−"}{formatUZS(t.amount)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==================== SERVER HEALTH ==================== */
function ServerHealthPanel({ onToast }: { onToast: (m: string, t?: "success" | "error") => void }) {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState("");
  const check = useCallback(async (quiet = false) => {
    try {
      const response = await apiFetch("/api/admin/health", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok && !data.checks) throw new Error(data.error || "Server holati olinmadi");
      setHealth(data);
      setLastError(data.status === "ok" ? "" : "Ma’lumotlar bazasi bilan aloqa uzilgan yoki xizmat qisman ishlayapti.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Server bilan aloqa yo‘q";
      setLastError(message); if (!quiet) onToast(message, "error");
    } finally { setLoading(false); }
  }, [onToast]);
  useEffect(() => {
    void check(true);
    const timer = window.setInterval(() => { void check(true); }, 30000);
    return () => window.clearInterval(timer);
  }, [check]);
  const fmtBytes = (bytes: number) => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const fmtUptime = (seconds: number) => { const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60); return `${d} kun ${h} soat ${m} daqiqa`; };
  return <div className="admin-health-wrap">
    <div className="admin-section-head"><div><h2 className="admin-h2">Server holati</h2><p className="admin-sub">Har 30 soniyada avtomatik tekshiruv</p></div><button className="admin-icon-btn" onClick={() => void check()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""}/></button></div>
    {lastError && <div className="admin-alert danger"><div className="admin-alert-icon"><AlertCircle size={18}/></div><div><div className="admin-alert-title">Tekshiruv bajarilmadi</div><div className="admin-alert-text">{lastError}</div></div></div>}
    {health && <><div className={`admin-alert ${health.status === "ok" ? "success" : "danger"}`}><div className="admin-alert-icon">{health.status === "ok" ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}</div><div><div className="admin-alert-title">{health.status === "ok" ? "Asosiy xizmatlar ishlayapti" : "Muammo aniqlandi"}</div><div className="admin-alert-text">Oxirgi tekshiruv: {new Date(health.checkedAt).toLocaleString("uz-UZ")}</div></div></div>
      <div className="admin-stats"><div className="admin-stat-card"><div className="admin-stat-icon blue"><Server size={18}/></div><div className="admin-stat-body"><div className="admin-stat-label">Jarayon ishlash vaqti</div><div className="admin-stat-value" style={{fontSize:16}}>{fmtUptime(health.uptimeSeconds)}</div><div className="admin-stat-meta">Node {health.nodeVersion}</div></div></div><div className="admin-stat-card"><div className="admin-stat-icon purple"><Activity size={18}/></div><div className="admin-stat-body"><div className="admin-stat-label">RAM (RSS)</div><div className="admin-stat-value">{fmtBytes(health.memory.rssBytes)}</div><div className="admin-stat-meta">Heap: {fmtBytes(health.memory.heapUsedBytes)} / {fmtBytes(health.memory.heapTotalBytes)}</div></div></div><div className="admin-stat-card"><div className="admin-stat-icon green"><ShieldCheck size={18}/></div><div className="admin-stat-body"><div className="admin-stat-label">Muhit</div><div className="admin-stat-value" style={{fontSize:18}}>{health.environment}</div><div className="admin-stat-meta">Server jarayoni</div></div></div></div>
      <div className="admin-panel"><div className="admin-panel-head"><h3 className="admin-h3">Xizmatlar tekshiruvi</h3></div><div className="admin-list">{Object.entries(health.checks as Record<string, any>).map(([key, item]) => <div className="admin-list-row" key={key}><div style={{minWidth:0,flex:1}}><div style={{fontSize:13,fontWeight:600}}>{{database:"Ma’lumotlar bazasi",bot:"Telegram bot konfiguratsiyasi",webApp:"Web App konfiguratsiyasi"}[key] || key}</div><div style={{fontSize:12,color:"var(--muted)",marginTop:3}}>{item.detail}{item.latencyMs !== undefined ? ` · ${item.latencyMs} ms` : ""}</div></div><span className={`admin-badge ${item.status === "ok" ? "primary" : ""}`} style={{color:item.status === "error" ? "var(--expense)" : item.status === "warning" ? "var(--accent-2)" : "var(--income)"}}>{item.status === "ok" ? "Ishlayapti" : item.status === "warning" ? "Diqqat" : "Xato"}</span></div>)}</div></div>
    </>}
  </div>;
}
