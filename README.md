# Hisobchi — shaxsiy moliya

Uzbek tilidagi, mobil-first Telegram Mini App uchun tayyorlangan Next.js + TypeScript loyihasi. Interfeys hozircha ishlaydigan **mahalliy prototip** rejimida: kiritilgan operatsiyalar brauzer `localStorage` xotirasida saqlanadi. PostgreSQL/Prisma sxemasi, Telegram `initData` tekshiruvi, API asoslari va grammY bot ham kiritilgan. Ular ishlab chiqarishdan oldin to‘liq ulanish va integratsion sinovdan o‘tkazilishi kerak; UI hozircha API bilan sinxronlanmaydi.

## Texnologiyalar
- Next.js App Router, React, TypeScript strict, Tailwind CSS v4
- Prisma + PostgreSQL, grammY
- Recharts, React Hook Form, Zod, date-fns dependency sifatida mavjud
- Vitest — moliyaviy hisob-kitob testlari

## Talablar
Node.js 20.9+ (tavsiya: Node 22), npm, Docker Desktop yoki mahalliy PostgreSQL.

## O‘rnatish
```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
Windows PowerShell uchun `.env.example` faylini `.env` nomiga nusxalang:
```powershell
Copy-Item .env.example .env
```
Brauzerda `http://localhost:3000` ni oching. `npm run dev` uchun bot token shart emas. Birinchi ishlatishda ma’lumotlar brauzeringizda saqlanadi; brauzer ma’lumotlari tozalansa, ular ham o‘chadi.

## Database
`docker compose up -d` PostgreSQL 16 konteynerini ishga tushiradi. Lokal ulanish URL’i `.env.example` ichida. So‘ng:
```bash
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
```
`prisma/seed.ts` ataylab soxta moliyaviy operatsiyalar yaratmaydi. Kategoriyalar hozirda UI’da boshlang‘ich ro‘yxat sifatida berilgan; serverda har bir foydalanuvchi uchun avtomatik seed qilish keyingi integratsiya vazifasi. Development bazasini tozalashdan oldin ma’lumot kerak emasligiga ishonch hosil qiling; qayta yaratish uchun `npx prisma migrate reset` (bu barcha development ma’lumotlarini o‘chiradi).

## Telegram bot
1. Telegram’da `@BotFather` orqali `/newbot` yuborib, bot yarating.
2. Tokenni `.env` ichidagi `BOT_TOKEN` ga kiriting. Tokenni hech qachon `NEXT_PUBLIC_...` o‘zgaruvchisiga qo‘ymang yoki GitHub’ga yubormang.
3. Mini App uchun ommaviy HTTPS URL kerak; uni `WEB_APP_URL` ga yozing. Lokal brauzer prototipi botsiz ishlaydi; Telegram ichidagi Web App uchun HTTPS tunnel yoki hosting kerak.
4. BotFather’da `/setmenubutton` orqali Mini App URL’ini belgilang yoki `/setdomain` sozlang.
5. `npm run bot` bilan long-polling botni ishga tushiring. Bir xil token uchun webhook va long polling’ni bir vaqtda ishlatmang.
6. Buyruqlar: `/start /today /week /month /top /balance /debts /last /add /budget /reminder /help`. Ovoz va matn orqali daromad, xarajat va **qarzlar**ni kiritish mumkin. Batafsil: [BOT.md](BOT.md). Hisobot buyruqlari DB’da Telegram ID orqali avval ro‘yxatdan o‘tgan foydalanuvchini talab qiladi.

## Environment variables
- `DATABASE_URL` — PostgreSQL ulanish satri
- `BOT_TOKEN` — BotFather tokeni (server-only)
- `WEB_APP_URL` — Mini App’ning HTTPS manzili
- `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` — initData muddati, default 86400
- `NODE_ENV` — development/production

## Checks
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## Hozirgi imkoniyatlar
- To‘rtta asosiy bo‘lim: Asosiy, Hisobot, Qarzlar, Profil.
- Tushum/xarajat qo‘shish, tahrirlash, o‘chirish, custom kategoriyalar.
- Oy bo‘yicha navigatsiya, haqiqiy kiritilgan ma’lumotlardan hisoblangan jami va farq.
- Hisobot ichida oylik statistika va kalendar; sana tanlash, kunlik yig‘indilar.
- Bergan/olgan qarzlar, qisman qaytarilgan to‘lovlar.
- JSON eksport va mahalliy ma’lumotlarni tozalash.
- Moliyaviy hisob-kitoblar uchun unit testlar.

## Muhim cheklovlar — ishlab chiqarishga chiqarishdan oldin
1. Asosiy UI demo/localStorage ishlatadi. Uni server API’ga ulash, Telegram WebApp SDK orqali `initData` yuborish va auth sessiyasini xavfsiz saqlash hali yakunlanmagan.
2. Telegram auth route foydalanuvchini tekshiradi, lekin token/cookie asosidagi sessiya qatlamini to‘liq amalga oshirmaydi. Hozirgi API route’lar `x-telegram-init-data` talab qiladi; `initData` ni brauzerdan har so‘rovda yuborishning muddati va replay xavfi nazorat qilinishi kerak.
3. Transaction API’da POST mavjud; PATCH/DELETE, category CRUD, debt/payment CRUD, rate limiting, CSRF/CORS siyosati va request idempotency’ni production darajasida yakunlash kerak.
4. Kalendar sanalari hozir brauzerning mahalliy vaqt zonasida ko‘rsatiladi. Serverdagi `occurredAt` vaqt zonasi strategiyasini `Asia/Tashkent` bilan integratsiya testlarida mustahkamlash lozim.
5. Telegram Mini App haqiqiy bot va HTTPS URL bilan bu muhitda verifikatsiya qilinmadi.
6. Recharts, React Hook Form, shadcn/ui dependency’lari ro‘yxatda bo‘lsa-da, ilk prototipda qo‘shimcha murakkablikni kamaytirish uchun maxsus CSS va oddiy formalar ishlatilgan.
7. Free hosting rejalari, kvotalari va always-on jarayonlar o‘zgarishi mumkin. Lokal ishlatish bepul; hostingda provider’ning joriy cheklovlarini rasmiy manbadan tekshiring. Bot long-polling doimiy ishlashi uchun hosting siyosati mos bo‘lishi kerak.

## Xavfsizlik eslatmasi
Bu loyiha hozir ishlab chiqish prototipi. Shaxsiy moliyaviy ma’lumotlar bilan real foydalanuvchilarga chiqarishdan oldin API/auth integratsiyasi, user ownership testlari, migratsiyalar va deployment sozlamalarini yakunlang. `.env` Git’ga qo‘shilmaydi.


## PostgreSQL doimiy saqlash va zaxira nusxa

Production’da UI ma’lumotlari Telegram Mini App `initData` orqali autentifikatsiyadan so‘ng `/api/data` endpointi orqali PostgreSQL’ga yoziladi. Brauzer `localStorage` endi server rejimida asosiy manba emas. Har bir so‘rovda Telegram `initData` serverda HMAC va muddat bo‘yicha tekshiriladi; DB so‘rovlari `userId` bilan cheklanadi. Server rejimi uchun `BOT_TOKEN` va HTTPS orqali ochilgan Telegram Mini App shart.

- `docker compose up -d` PostgreSQL volume `hisobchi_pgdata` yordamida ma’lumotni konteyner qayta ishga tushganda saqlaydi. Volume’ni `docker compose down -v` bilan o‘chirmang.
- Migratsiyalarni qo‘llash: `npx prisma migrate deploy`
- Zaxira nusxa (Linux/VPS): `bash scripts/backup-postgres.sh`
- Zaxira nusxani tiklash: `bash scripts/restore-postgres.sh ./backups/hisobchi-YYYYMMDDTHHMMSSZ.sql.gz` (amaldagi DB yozuvlarini almashtirishi mumkin; alohida tasdiq talab qiladi).
- Standart saqlash muddati 14 kun; `BACKUP_RETENTION_DAYS` orqali o‘zgartiring. `backups/` katalogini serverdan tashqaridagi xavfsiz joyga ham nusxalash tavsiya qilinadi.
- Avtomatik rejalashtirish Linux cron orqali sozlanadi, masalan: `0 2 * * * cd /path/to/hisobchi && /bin/bash scripts/backup-postgres.sh >> backups/backup.log 2>&1`. Katalog va ruxsatlarni avval tekshiring.

**Muhim:** zaxira skriptini yaratish avtomatik jadvalni o‘zi yoqmaydi; cron yoki server scheduler’da alohida sozlash kerak. Bu muhitda haqiqiy PostgreSQL serveriga ulanish, restore drill yoki production build bajarilmadi. Ishga tushirishdan oldin staging bazada restore testini bajaring.

## Admin panel yaxshilanishlari (performance)
Muammo: har so'rovda butun `Transaction` jadvali yig'ilar edi (12 ta so'rov) va har admin so'rovda `lastActiveAt` yozilardi.
1. **SWR + single-flight kesh** (`src/lib/admin-cache.ts`) — parallel so'rovlar bitta hisobga birlashadi.
2. **Token-bucket rate limit** (`src/lib/rate-limit.ts`) — refresh-storm va suiiste'moldan himoya.
3. **ETag / 304** (`src/lib/http.ts`) — o'zgarmagan javob body'siz.
4. **Postgres snapshot** (`AdminStatsSnapshot`) — og'ir hisob 5 daqiqada 1 marta, restartdan keyin ham tayyor.
5. **Streaming CSV eksport + keyset pagination** (`/api/admin/export`).
Qo'shimcha: 12 so'rov -> 7 ta jamlangan SQL, 30 kunlik grafik, eng faol userlar, har user tushum/xarajati, debounce qidiruv, visibility-aware polling, foydalanuvchi sahifasidagi noto'g'ri (faqat 100 ta tranzaksiya) yig'indi tuzatildi, `lastActiveAt` 5 daqiqada 1 marta yoziladi.
Yangilashdan so'ng: `npx prisma migrate deploy`.

## Adminlar
`.env` dagi `ADMIN_TELEGRAM_IDS="111,222"` (vergul bilan) — shu Telegram ID lar Mini App ochilganda avtomatik ADMIN bo'ladi va admin panelga tushadi. Terminalda `db:seed` shart emas. Adminda "User rejimi" tugmasi va user rejimida suzuvchi "Admin panel" tugmasi bor. `.env` o'zgargach serverni qayta ishga tushiring.

## Hisobchi AI (Gemini + Groq)
- Web ilovada `AI` bo'limi mavjud. AI foydalanuvchining o'ziga tegishli oxirgi 12 oylik tranzaksiyalar, kategoriya yig'indilari va ochiq qarzlaridan kontekst tayyorlaydi.
- Provayder tartibi: avval Gemini; quota/rate-limit (429), vaqtinchalik server xatosi (5xx), timeout yoki tarmoq xatosida Groq zaxira sifatida ishlatiladi. Noto'g'ri kalit yoki yaroqsiz so'rovda takroriy provayder almashtirish bajarilmaydi.
- Kalitlar faqat serverdagi `.env` ichida saqlanadi: `GEMINI_API_KEY`, `GROQ_API_KEY`. Model nomlari `GEMINI_MODEL` va `GROQ_MODEL` bilan boshqariladi. Groq uchun standart model `openai/gpt-oss-120b` bo‘lib, `max_completion_tokens=2048` va `reasoning_effort=medium` ishlatiladi. Ularni hech qachon `NEXT_PUBLIC_` bilan boshlamang.
- Suhbat tarixi `AiConversation`/`AiMessage` jadvallarida saqlanadi. Uzoq muddatli xotira ixtiyoriy va foydalanuvchi roziligi bilan yoqiladi; matnni o'zi tahrirlashi yoki o'chirishi mumkin.
- AI mavzu doirasi shaxsiy moliya bilan cheklangan. U ma'lumotlar bazasini o'zgartirish huquqiga ega emas. Moliyaviy faktlar faqat backend tomonidan tanlangan, autentifikatsiya qilingan foydalanuvchining ma'lumotlaridan olinadi.
- Yangi migratsiya: `20261025150000_ai_advisor`. Mavjud migratsiyalar o'zgartirilmagan. Yangilashda avval zaxira oling, keyin `npx prisma migrate deploy` va `npx prisma generate` bajaring.
- AI API real Telegram Mini App `initData` bilan ishlaydi; oddiy brauzer preview rejimida moliyaviy ma'lumotlarga kirish ataylab rad etiladi.

## Changes in this package

- Added owner-scoped `PUT` and `DELETE` handlers to `/api/transactions` for editing and deleting individual transactions.
- Added `/api/announcement`: authenticated users can read the active Web App announcement; admins can create, update, activate, or deactivate it.
- Added the admin dashboard's **Web App e’loni** panel. The user-facing Mini App polls for announcements once per minute and lets users dismiss the banner.
- Added a UZ/RU language toggle in the Mini App. The Russian translation map currently covers common navigation and transaction actions; review/complete the translation map for every screen before treating the app as fully localized.
- Removed the uploaded `.env` containing credentials. Copy `.env.example` to `.env` and enter fresh secrets before running the project.

Run `npm ci`, `npm run db:generate`, `npm run typecheck`, `npm test`, and `npm run build` in an environment with access to the configured package registry and PostgreSQL before deploying.
