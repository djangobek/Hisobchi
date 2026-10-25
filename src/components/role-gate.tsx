"use client";

import { useEffect, useState } from "react";
import FinanceApp from "./finance-app";
import AdminApp from "./admin-app";
import { useI18n } from "@/lib/i18n-client";

type Role = "USER" | "ADMIN" | null;

export default function RoleGate() {
  const { t } = useI18n();
  const [role, setRole] = useState<Role>(null);
  const [checking, setChecking] = useState(true);
  // Tanlangan rejim eslab qolinadi (sahifa yangilansa ham saqlanadi)
  const [userOverride, setUserOverrideState] = useState(false);
  const setUserOverride = (v: boolean) => {
    setUserOverrideState(v);
    try { sessionStorage.setItem("hisobchi_user_mode", v ? "1" : "0"); } catch {}
  };
  useEffect(() => {
    try { setUserOverrideState(sessionStorage.getItem("hisobchi_user_mode") === "1"); } catch {}
  }, []);

  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp;
    const initData = tg?.initData ?? "";

    if (!initData) {
      setRole("USER");
      setChecking(false);
      return;
    }

    fetch("/api/admin/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    })
      .then(async r => {
        const d = await r.json();
        if (d.error) setRole("USER");
        else setRole(d.isAdmin ? "ADMIN" : "USER");
      })
      .catch(() => setRole("USER"))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        color: "var(--muted)",
        fontSize: 14,
      }}>
        {t("Yuklanmoqda...")}
      </div>
    );
  }

  // User rejimi override
  const showAdmin = role === "ADMIN" && !userOverride;

  if (showAdmin) {
    return <AdminApp onSwitchToUser={() => setUserOverride(true)} />;
  }

  return (
    <>
      <FinanceApp
        onSwitchToAdmin={role === "ADMIN" ? () => setUserOverride(false) : undefined}
      />
      {role === "ADMIN" && (
        <button
          onClick={() => setUserOverride(false)}
          style={{
            position: "fixed", right: 12, bottom: 84, zIndex: 50, border: 0, borderRadius: 999,
            padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)", boxShadow: "0 6px 18px rgba(99,102,241,.45)",
          }}
        >
          🛡 {t("Admin panel")}
        </button>
      )}
    </>
  );
}