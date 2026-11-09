# Hisobchi — tuzatishlar

## Ushbu versiyada
- `npm run bot` endi Node.js 22 `--env-file-if-exists` orqali `.env` ni avtomatik yuklaydi; lokal botning `.env` sozlamalarini o‘qimasligi muammosi bartaraf etildi.
- Bir xil Telegram bot tokeni bilan bir nechta hosting instance polling boshlashining oldi olindi: PostgreSQL `AppSetting` jadvalidagi 60 soniyalik lease, 15 soniyalik heartbeat.
- Webhook faol bo‘lsa, polling uni avtomatik o‘chirmaydi va xavfsiz tarzda ishga tushmaydi. Bitta update transportidan foydalanish kerak.
- Ovozli transkripsiyadan keladigan `1 500 000`, `250,000`, `1.500.000` ko‘rinishidagi summalar bitta miqdor sifatida o‘qiladi.
- `taksiga 25 ming` yoki `ovqat 40 ming` kabi fe'lsiz, lekin aniq xarajat kategoriyasi ko‘rsatilgan iboralar lokal fallback orqali xarajat sifatida taniladi.
- Yangi parser regression testlari qo‘shildi.
- Maxfiy `.env` fayli tarqatma arxivdan chiqarildi. Ishga tushirishdan oldin `.env.example` dan yangi `.env` yarating.

## Tekshiruv
- `src/lib/voice-parser.ts` TypeScript kompilyatsiyasidan alohida muvaffaqiyatli o‘tdi.
- Summalarni ajratish va lokal xarajat/daromad parserining asosiy holatlari Node orqali tekshirildi.
- To‘liq `npm ci`, `npm test`, `npm run typecheck` va `npm run build` bajarilmadi: paketlar registridan o‘rnatish vaqt limiti ichida tugamadi. Deploydan oldin ularni dependencies mavjud muhitda ishga tushiring.

## Deploy eslatmasi
- Bir xil bot tokeni uchun faqat bitta polling worker faol bo‘lishi kerak; kod DB lease bilan qo‘shimcha himoya qo‘shadi.
- Webhook ishlatilayotgan bo‘lsa, pollingni yoqmang.
- Arxivdagi `.env` olib tashlangan. Oldingi `.env` ichidagi tokenlar va API kalitlari arxiv bilan ulashilgan bo‘lishi mumkin; ularni yangilang.
