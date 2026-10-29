# Hisobchi boti — yangilanish (v2)

## Ovoz tizimi
**Nutq → matn:** ElevenLabs Scribe (asosiy) → Muxlisa AI (zaxira).
- 5xx/timeout bo'lsa — bir marta qayta uriniladi.
- Kalit xato yoki kvota tugasa (401/402/403/429) provayder 5 daqiqaga navbat oxiriga suriladi (circuit breaker), shuning uchun har xabarda vaqt yo'qotilmaydi.

**Matn → operatsiya:** Gemini (bir nechta model) → Groq → **lokal parser** (`src/lib/voice-parser.ts`).
Lokal parser o'zbek va rus sonlarini ("yetti yuz ellik ming", "bir yarim million", "пятьсот тысяч") va qarz iboralarini tushunadi — barcha AI kvotalari tugasa ham bot ishlayveradi.
AI natijasi lokal parser bilan o'zaro tekshiriladi: matnda yo'q summa "⚠️ Summani tekshiring" deb belgilanadi.

## Kategoriyalar (v3)
- Bot **faqat sizning mavjud kategoriyalaringizdan** tanlaydi; AI'ga standart ro'yxat aralashtirilmaydi va yangi nom o'ylab topish taqiqlangan.
- AI nomi `src/lib/category-match.ts` orqali mavjud kategoriyaga moslanadi: aniq nom → gapdagi o'z kategoriyangiz nomi ("kofega" → «Kofe») → sinonim/rus tarjimasi → yaqin yozilish → kalit so'z qoidasi.
- Hech biri mos kelmasa — «Boshqa» (tushumda «Boshqa tushum»), draftda ❓ belgisi bilan ko'rsatiladi. Yangi kategoriya hech qachon yaratilmaydi.
- Draftda 🏷 tugmasi: kategoriyani ro'yxatdan qo'lda almashtirish mumkin (saqlashdan oldin).

## Qarzlar (yangi)
| Aytilgan gap | Natija |
|---|---|
| «Alisherdan 500 ming qarz oldim» | 📥 Olingan qarz (Alisher) |
| «Boburga 300 ming qarz berdim» | 📤 Berilgan qarz (Bobur) |
| «Dilnoza qarzini qaytardi 100 ming» | ✅ Dilnozaning qarziga to'lov |
| «Alisherga qarzimni qaytardim 200 ming» | 💸 Sizning qarzingizga to'lov |

- Qaytarish mavjud ochiq qarzga ism bo'yicha moslanadi (Alisher ≈ Alisherga ≈ Алишер ≈ Alishr), eng eski qarzdan boshlab (FIFO). Qarzdan ortiq summa ogohlantiriladi.
- Mos qarz topilmasa yoki ism noaniq bo'lsa yozuv saqlanmaydi va sababi ko'rsatiladi.
- Qarzlar tushum/xarajatga qo'shilmaydi (ilovadagi mantiq bilan bir xil) va Mini App'dagi «Qarzlar» bo'limida ko'rinadi.
- Muddat aytilsa ("bir haftaga") `dueAt` saqlanadi.

## Tasdiqlash oqimi
Hamma narsa avval **draft** sifatida ko'rsatiladi: har bir yozuvni 🗑 bilan olib tashlash, keyin ✅ Saqlash. Saqlash bitta DB tranzaksiyasida bajariladi (hammasi yoki hech nima).

## Yangi buyruqlar
`/week` 7 kunlik grafik · `/top` top kategoriyalar · `/balance` umumiy holat (qarzlar bilan) · `/last` oxirgi yozuvlar + o'chirish · `/add` tez qo'shish · `/budget 3000000` oylik limit (80%/100% da ogohlantiradi) · `/reminder on` 09:00 qarz muddati va 21:00 kunlik xulosa.
Yaxshilangan: `/today` (ro'yxat bilan), `/month` (o'tgan oyga solishtirish, jamg'arish darajasi, top xarajatlar), `/debts` (guruhlangan, muddati o'tganlar ⏰).
Oddiy matn ham ovoz kabi tahlil qilinadi: «taksiga 18000, bozorga 120 ming».

## Tuzatilgan xatolar
- Sanalar endi doim Asia/Tashkent bo'yicha (`/today` serverda UTC bo'lsa noto'g'ri kunni ko'rsatardi).
- Gemini API kaliti URL o'rniga `x-goog-api-key` sarlavhasida yuboriladi (loglarda oshkor bo'lmaydi).
- Bot 1 faylli 560 qatordan 9 ta modulga bo'lindi (`bot/`), foydalanuvchi bo'yicha so'rovlar limiti qo'shildi.

## Baza
**Migratsiya kerak emas.** Byudjet va eslatma sozlamalari mavjud `AppSetting` jadvalida saqlanadi.

## Cheklovlar
- Draft'lar xotirada (15 daqiqa); bot qayta ishga tushsa tasdiqlanmagan draft yo'qoladi — ovozni qayta yuborish kifoya.
- Bot va Mini App bir vaqtda ochiq bo'lsa, Mini App eski holatni saqlasa botdan kiritilgan yozuvlarni ustidan yozishi mumkin (ilovadagi `/api/data` to'liq snapshot sinxronlaydi). Botdan kiritgandan so'ng ilovani qayta oching.
- Bu muhitda internet va Telegram/ElevenLabs/Muxlisa kalitlari yo'q edi: STT/NLU zanjiri soxta HTTP javoblari bilan sinaldi, haqiqiy API bilan emas. Kalitlarni qo'ygach `/start` va bitta ovozli xabar bilan tekshiring.

## Tekshiruv
```bash
npm install && npx prisma generate
npm run typecheck && npm test && npm run bot
```
