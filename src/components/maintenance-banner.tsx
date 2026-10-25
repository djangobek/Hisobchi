"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n-client";

export default function MaintenanceBanner() {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/maintenance-status");
        const data = await res.json();
        if (!cancelled) {
          setEnabled(data.enabled);
          setMessage(data.message);
        }
      } catch {}
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (!enabled) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0,
      zIndex: 50,
      background: "linear-gradient(90deg, #f59e0b, #ea580c)",
      color: "white",
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      fontSize: 13,
      fontWeight: 600,
      boxShadow: "0 4px 20px rgba(245, 158, 11, 0.4)",
    }}>
      <Wrench size={15} />
      {t(message || "🛠 Botda texnik ishlar ketmoqda.")}
    </div>
  );
}