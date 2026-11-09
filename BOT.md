# Hisobchi boti — yangilanish (v2)

## Ovoz tizimi (AI qayta qurilgan)
**Nutq → matn (STT):** Muxlisa AI (asosiy) → ElevenLabs Scribe (faqat zaxira). Gemini/Groq STT sifatida ishlatilmaydi.
- Muxlisa muvaffaqiyatli bo'lsa ElevenLabs **chaqirilmaydi**.
- 5xx/timeout/tarmoq xatosida bir marta qayta uriniladi; kalit/kvota xatosida (401/402/403/429) provayder 5 daqiqaga navbat oxiriga suriladi (circuit breaker).
- Bo'sh yoki yaroqsiz transkripsiya ("...", "[noaniq]") ham zaxiraga o'tish sababi.
- Audio faqat xotirada ushlanadi, diskka yozilmaydi.

**Matn → operatsiya (NLU):** Groq (yagona AI) → lokal parser (`src/lib/voice-parser.ts`, faqat Groq ishlamaganda).
- JSON javob `{"operations":[...]}` ko'rinishida; ```json fence, oldidan/keyin izoh, bitta obyekt yoki massiv ko'rinishi ham xavfsiz o'qiladi.
- AI natijasi transkripsiyadagi summalar bilan o'zaro tekshiriladi; aytilmagan summa rad etiladi.
- Noaniq summa (`null`/0), so'mdan boshqa valyuta, qarzda ism yo'qligi — bazaga yozilmaydi, foydalanuvchiga "aniqroq ayting" deyiladi.

**Ovoz uzunligi:** 15 soniyadan uzun xabarda aniqlik haqida ogohlantirish ko'rsatiladi (`VOICE_WARN_SECONDS`); `VOICE_MAX_SECONDS` (60) dan uzuni rad etiladi (mavjud loyiha limiti saqlangan).

**Takroriy yozuvdan himoya:** `update_id` dedup (middleware), xabar bo'yicha qayta ishlash qulfi, saqlashda `AppSetting` markeri (`voice:done:<user>:<xabar>`) + `requestKey` unique indeksi.

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
- Matnni operatsiyaga aylantirishda summa matndan qat'iy tekshiriladi: AI aytilmagan yoki ortiqcha takrorlangan summani saqlay olmaydi. Groq tashlab ketgan summalar avtomatik qo'shilmaydi — "noaniq" deb foydalanuvchiga ko'rsatiladi.
- Bot 1 faylli 560 qatordan 9 ta modulga bo'lindi (`bot/`), foydalanuvchi bo'yicha so'rovlar limiti qo'shildi.

## Baza
**Migratsiya kerak emas.** Byudjet va eslatma sozlamalari mavjud `AppSetting` jadvalida saqlanadi.

## Cheklovlar
- Draft'lar xotirada (15 daqiqa); bot qayta ishga tushsa tasdiqlanmagan draft yo'qoladi — ovozni qayta yuborish kifoya.
- Bot va Mini App bir vaqtda ochiq bo'lsa, Mini App eski holatni saqlasa botdan kiritilgan yozuvlarni ustidan yozishi mumkin (ilovadagi `/api/data` to'liq snapshot sinxronlaydi). Botdan kiritgandan so'ng ilovani qayta oching.
- Haqiqiy Muxlisa, ElevenLabs va Groq API chaqiruvlari deployment muhitida alohida sinovdan o'tkazilishi kerak. Kalitlarni qo'ygach `/start` va turli summali 3-4 ta ovozli xabar bilan tekshiring.

## Tekshiruv
```bash
npm install && npx prisma generate
npm run typecheck && npm test && npm run bot
```
