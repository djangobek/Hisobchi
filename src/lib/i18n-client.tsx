"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANG_STORAGE_KEY, catName, langFromTelegram, localeOf, t as translate, toLang, type Lang } from "./i18n";

type Ctx = {
  lang: Lang;
  /** Tilni o'zgartiradi (brauzerda eslab qoladi va Telegram sessiyasi bo'lsa serverga yozadi — bot va AI ham shu tilda javob beradi). */
  setLang: (next: Lang, opts?: { persist?: boolean }) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  cat: (name: string) => string;
  locale: string;
};

const I18nContext = createContext<Ctx | null>(null);

function tgInitData() {
  return (window as Window & { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp?.initData ?? "";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");

  useEffect(() => {
    let initial: Lang | null = null;
    try { const saved = localStorage.getItem(LANG_STORAGE_KEY); if (saved === "ru" || saved === "uz") initial = saved; } catch {}
    if (!initial) {
      const code = (window as Window & { Telegram?: { WebApp?: { initDataUnsafe?: { user?: { language_code?: string } } } } }).Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
      initial = langFromTelegram(code ?? navigator.language);
    }
    setLangState(initial);
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((next: Lang, opts?: { persist?: boolean }) => {
    const value = toLang(next);
    setLangState(value);
    try { localStorage.setItem(LANG_STORAGE_KEY, value); } catch {}
    if (opts?.persist === false) return;
    const initData = tgInitData();
    if (!initData) return;
    void fetch("/api/lang", {
      method: "POST", cache: "no-store",
      headers: { "Content-Type": "application/json", "x-telegram-init-data": initData },
      body: JSON.stringify({ language: value }),
    }).catch(() => { /* tarmoq xatosi: keyingi kirishda qayta urinadi */ });
  }, []);

  const value = useMemo<Ctx>(() => ({
    lang, setLang,
    t: (key, params) => translate(lang, key, params),
    cat: name => catName(lang, name),
    locale: localeOf(lang),
  }), [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

/** Joriy tilni serverga yuborish uchun sarlavha (AI javob tili). */
export const langHeader = (lang: Lang) => ({ "x-lang": lang });
