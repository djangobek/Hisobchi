# Hisobchi AI v3 — o'zgarishlar

Fayllarni loyihadagi o'z joyiga qo'ying (ustiga yozing):
- src/app/api/ai/route.ts
- src/components/ai-advisor.tsx
- src/app/globals.css
- .env.example

.env:  GEMINI_MODEL=gemini-3.5-flash-lite,gemini-3.8-flash
Baza migratsiyasi kerak emas.

## Til tizimi (uz / ru)
- `src/lib/i18n.ts` — umumiy lug'at (UI, bot, AI); `src/lib/i18n-client.tsx` — `useI18n()` hook va `I18nProvider` (layout'da).
- Foydalanuvchi ilovasi (Asosiy, Hisobot, Qarzlar, Profil, AI, modallar, xabarlar, sanalar, valyuta) to'liq ikki tilda. Standart kategoriyalar nomi ham tarjima qilinadi.
- Til `User.language` ga saqlanadi (`POST /api/lang`); Telegram tilidan avtomatik aniqlanadi. Profil sahifasida va yuqoridagi tugmada almashtiriladi.
- Bot: barcha matnlar ikki tilda, `/lang` buyrug'i va /start'dagi til tugmalari, buyruqlar menyusi ham tarjima qilingan.
- AI: `x-lang` sarlavhasi bo'yicha ruscha so'ralsa ruscha, o'zbekcha so'ralsa o'zbekcha javob beradi (system prompt, tezkor xulosalar, tahlil matnlari ham).
- Admin panel o'zgartirilmadi — faqat o'zbekcha.
