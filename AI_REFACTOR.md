# Hisobchi bot — AI qayta qurish (STT: Muxlisa → ElevenLabs, NLU: Groq → lokal)

## Arxitektura
```
Ovozli xabar ──► bot/voice.ts ──► bot/stt.ts ──► ai/muxlisa.ts   (asosiy)
                                       └──────► ai/elevenlabs.ts (faqat Muxlisa xato/bo'sh/yaroqsiz bo'lsa)
                     │
                     └──► bot/nlu.ts ──► ai/groq.ts (yagona AI) ──► ai/json.ts (xavfsiz parse)
                                    └──► src/lib/voice-parser.ts (faqat Groq ishlamasa)
                     └──► tasdiqlash (inline tugmalar) ──► store.ts (transaction + dedup) ──► PostgreSQL
```
`bot/ai/`: `errors.ts` (xato kategoriyalari, redact, breaker) · `http.ts` (timeout, cheklangan retry) · `json.ts` · `text.ts` · `muxlisa.ts` · `elevenlabs.ts` · `groq.ts`.

## O'zgargan / yangi fayllar
**Yangi:** `bot/ai/{errors,http,json,text,muxlisa,elevenlabs,groq}.ts`, `bot/dedup.ts`, `tests/{groq-json,stt-chain,nlu-groq}.test.ts`, `tests/ai-helpers.ts`, `AI_REFACTOR.md`
**Qayta yozilgan:** `bot/stt.ts`, `bot/nlu.ts`
**O'zgartirilgan:** `bot/voice.ts`, `bot/store.ts` (`commitOperations` dedup), `bot/config.ts`, `bot/index.ts`, `src/lib/voice-parser.ts` (qo'shimchali "mingga/millionni"), `tests/bot-utils.test.ts`, `tests/voice-parser.test.ts`, `.env.example`, `README.md`, `BOT.md`, `VOICE_AI_UPGRADE.md`
**Tegilmagan:** Web App, admin panel, Prisma sxemasi/migratsiyalar (migratsiya kerak emas), `bot/commands.ts`, `src/app/api/ai/route.ts` (web-ilovadagi AI maslahatchi Gemini'da qoladi).

## Tuzatilgan xatolar
1. **`[NLU] groq muvaffaqiyatsiz: AI JSON ichida operations massivi yo'q` — ildiz sabab.** Prompt Groq'dan "faqat JSON **massiv**" so'ragan, system xabari esa `{"operations":[…]}` deb turgan; `response_format: json_object` esa faqat *obyekt* qaytarishga majbur qiladi. Model ziddiyatda bitta operatsiya obyektini yoki boshqa kalitni qaytarardi → parser `operations` topolmasdi. Endi: bitta aniq format (`{"operations":[…]}`), tolerant parser (fence, izoh, bitta obyekt, massiv, `transactions`/`data.operations`, satrli JSON), Groq `json_validate_failed` → `failed_generation` dan tiklash, buzilgan javobda qat'iy ko'rsatma bilan bir marta qayta so'rash.
2. **Javob kesilishi:** `max_completion_tokens` 2048 (gpt-oss'da fikrlash tokenlari ham sanaladi) → 4096, `reasoning_effort=low`. Kesilgan JSON endi parse xatosi sifatida ushlanadi.
3. **Muxlisa/ElevenLabs javobida xato matni transkripsiya bo'lib qolishi:** eski `extractText` har qanday satrni (masalan `{"message":"Unauthorized"}`) qaytarishi mumkin edi. Endi faqat ma'lum kalitlar.
4. **Tartib:** Gemini → ElevenLabs → Muxlisa edi; endi Muxlisa → ElevenLabs. Gemini botdan to'liq chiqarildi.
5. **"120 mingga"** (qo'shimchali miqyos) 120 deb o'qilardi → to'g'ri summa AI'dan rad etilardi. `voice-parser.ts` tuzatildi.
6. **Eskirgan test** (`matnda yo'q summani belgilaydi`) joriy xulq-atvorga (rad etish) moslandi.
7. **Takroriy yozuv:** `requestKey` har draft uchun tasodifiy edi — bir xil audio qayta ishlansa ikki marta saqlanishi mumkin edi. Endi barqaror manba kaliti (`voice:<chat>:<message>`), DB markeri (`AppSetting` PK) va `update_id` dedup.
8. **Texnik xato foydalanuvchiga ko'rinardi** (`voiceRetry` + xabar matni). Endi faqat sodda tushuntirish; tafsilot logda, kalitlar `***` bilan yashiriladi.
9. **Noaniq summa:** `amount:null/0`, so'mdan boshqa valyuta, qarzda ism yo'q → yozilmaydi, "aniqroq ayting" deyiladi. Groq tashlab ketgan summa avtomatik qo'shilmaydi (avval lokal parser jimgina qo'shardi).
10. **15 soniya:** ogohlantirish qo'shildi; mavjud 60 soniyalik qattiq limit saqlandi (ikkalasi `.env` orqali).

## `.env` o'zgaruvchilari
```
MUXLISA_API_KEY=            # asosiy STT
ELEVENLABS_API_KEY=         # zaxira STT (ixtiyoriy)
ELEVENLABS_STT_MODEL=scribe_v1
ELEVENLABS_STT_LANGUAGE=uz  # yoki auto
GROQ_API_KEY=               # NLU
GROQ_MODEL=openai/gpt-oss-120b,llama-3.3-70b-versatile
# ixtiyoriy: MUXLISA_STT_URL, MUXLISA_AUDIO_FIELD, MUXLISA_TIMEOUT_MS, ELEVENLABS_TIMEOUT_MS, GROQ_TIMEOUT_MS
VOICE_MAX_SECONDS=60  VOICE_WARN_SECONDS=15
```
`GEMINI_*` o'zgaruvchilarini botdan olib tashlashingiz mumkin (faqat web-ilovadagi AI bo'limi ishlatadi).

## Test natijalari — MOCK va REAL alohida
**Mock testlar** (fetch almashtirilgan; haqiqiy API chaqirilmagan): 115 ta o'tdi, 0 xato — Groq JSON parse (36), STT zanjiri + fallback (16), NLU + Groq xatolari + lokal fallback + dedup (26), mavjud `bot-utils`, `category-match`, `voice-parser`, `finance` testlari.
**Real integratsiya: TEKSHIRILMAGAN.** Sandbox'da tarmoq va API kalitlari yo'q edi. Muxlisa endpoint/maydon nomi (`/api/v2/stt`, `x-api-key`, `audio`) eski koddan olindi va rasmiy hujjat bilan solishtirib bo'lmadi — kabinetdagi hujjat bilan tasdiqlang (farq bo'lsa `MUXLISA_STT_URL`/`MUXLISA_AUDIO_FIELD`). Telegram ovozi OGG/Opus; Muxlisa uni qabul qilmasa 4xx qaytadi va ElevenLabs'ga o'tiladi — logdagi `[STT] muxlisa muvaffaqiyatsiz` qatoriga qarang.
**Bajarilmagan (dependency o'rnatib bo'lmadi):** `npm run typecheck`, `npm run build`, `npm run bot`, haqiqiy `vitest`. O'rniga: yangi/o'zgargan modullar `tsc` bilan tekshirildi (grammy/prisma tiplari yo'q — faqat shu modul xatolari filtrlandi, boshqa xato topilmadi), `voice.ts`/`store.ts`/`index.ts` esbuild bilan sintaksis tekshiruvidan o'tdi, testlar vitest-mos yengil shim bilan ishga tushirildi. `voice.ts`, `store.ts`, `index.ts` to'liq tiplar bilan tekshirilmagan.

## Ishga tushirish
```bash
cp .env.example .env        # kalitlarni yozing (o'zingizning eski .env ni ishlatsangiz ham bo'ladi)
npm ci && npx prisma generate
npm run typecheck && npm test && npm run build
npm run bot                 # logda: [STT] Muxlisa (asosiy): ✓ ... [NLU] Groq (asosiy): ✓
```
Sinov: botga "Do'kondan 120 mingga mahsulot oldim, taksiga 25 ming sarfladim" deb ovoz yuboring → ikkita operatsiya bilan tasdiqlash xabari chiqishi kerak. Logda `STT=muxlisa`, `nlu=groq` ko'rinadi.
