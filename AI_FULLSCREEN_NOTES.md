# AI sahifa — to'liq ekranli dizayn

O'zgargan fayllar:
- src/components/ai-advisor.tsx  — yangi UI (robot, salomlashuv, composer, bottom-sheet, ovozli kiritish, orqaga tugmasi)
- src/components/finance-app.tsx — AI endi <main> tashqarisida, overlay sifatida ochiladi (onClose -> "Asosiy")
- src/app/globals.css            — oxirida `.aiv-*` stillari
- src/lib/i18n.ts                — yangi matnlarning ruscha tarjimasi
- src/app/layout.tsx             — iOS/Android full-screen meta (appleWebApp, interactiveWidget)
- src/app/manifest.ts + public/icons/* — PWA manifest (display: fullscreen/standalone)

Telegram sozlamalari: ai-advisor.tsx ichida `TG_FULLSCREEN = true`. Telegram'ning o'z sarlavhasi qolsin desangiz `false` qiling.
