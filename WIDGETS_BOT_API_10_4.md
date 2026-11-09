# Hisobchi — oylik hisobot widgeti (Bot API 10.4 beta)

## Nima bor
- `bot/widgets/dashboard.html` — ixcham, mavzuga mos widget: **daromad**, **xarajat** va ularning **farqi**.
- Tepada `‹  Noyabr 2026  ›` tugmalari: oldingi oyga o‘tish, joriy oyga qaytish. Kelajak oylar ochilmaydi; undan oldin ma’lumot bo‘lmasa `‹` o‘chirilgan bo‘ladi.
- `bot/widgets.ts` — widgetni yuboradi va `widget_query` (`m:cur` yoki `m:YYYY-MM`) ga javob beradi.
- Buyruq: `/dashboard`; `/start` da (widgetlar yoqilganda) «📊 Oylik hisobot» tugmasi.

Tezkor tranzaksiya (`/quick`) widgeti olib tashlandi. Prisma sxemasi o‘zgarmagan.

## Yoqish
```env
WIDGETS_ENABLED="true"
TELEGRAM_BOT_API_BASE_URL="https://api.telegram.org/beta"
```
Botni qayta ishga tushiring, so‘ng `/dashboard` yuboring.

## Cheklovlar va xavfsizlik
- Widget tarmoqqa chiqmaydi; faqat `TelegramWidget.request()` (≤64 bayt) ishlatiladi, javob ≤1024 bayt.
- So‘rovlar faqat so‘ragan foydalanuvchining `userId` bo‘yicha filtrlanadi; xabar holatiga moliyaviy raqam yozilmaydi.
- Oy chegaralari Toshkent vaqti (UTC+5) bo‘yicha hisoblanadi.
- Widget balandligi kontentga moslangan (`height: 0`). Telegram klienti boshqacha o‘lchasa, `bot/widgets.ts` ichidagi `sendDashboard` da `height` ni qo‘lda (taxminan 200–220) bering.
- Bu kod haqiqiy beta Bot API'da sinab ko‘rilmagan; ishlab chiqarishga chiqarishdan oldin staging'da tekshiring.
