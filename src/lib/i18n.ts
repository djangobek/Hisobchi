/**
 * Til tizimi (uz / ru) — foydalanuvchi ilovasi, bot va AI uchun umumiy.
 * Admin panel bu faylga bog'lanmagan: u faqat o'zbek tilida qoladi.
 *
 * Lug'at kaliti — o'zbekcha matn (apostrof turlari normallashtiriladi).
 * Kalit topilmasa, o'zbekcha matnning o'zi qaytariladi.
 */
export type Lang = "uz" | "ru";
export const DEFAULT_LANG: Lang = "uz";
export const LANG_STORAGE_KEY = "hisobchi-language";

export const isLang = (v: unknown): v is Lang => v === "uz" || v === "ru";
export const toLang = (v: unknown): Lang => (v === "ru" ? "ru" : "uz");
/** Telegram `language_code` (ru, ru-RU, uk...) → ilova tili. Faqat "ru" bo'lsa rus tili. */
export const langFromTelegram = (code?: string | null): Lang => (code && /^ru/i.test(code) ? "ru" : "uz");
export const localeOf = (lang: Lang) => (lang === "ru" ? "ru-RU" : "uz-UZ");

const norm = (s: string) => s.replace(/[‘’ʻʼ`´]/g, "'");

const RU: Record<string, string> = {
  /* ---- navigatsiya / sarlavhalar ---- */
  "Asosiy": "Главная", "Hisobot": "Отчёт", "AI": "ИИ", "Qarzlar": "Долги", "Profil": "Профиль",
  "Asosiy navigatsiya": "Основная навигация",
  "SHAXSIY MOLIYA": "ЛИЧНЫЕ ФИНАНСЫ", "Xush kelibsiz": "Добро пожаловать", "AI maslahatchi": "ИИ-помощник",
  "Mening hisobim": "Мой счёт", "Tilni almashtirish": "Сменить язык", "Profilni ochish": "Открыть профиль",
  "E'lonni yopish": "Закрыть объявление", "Yuklanmoqda...": "Загрузка...",
  "Oldingi oy": "Предыдущий месяц", "Keyingi oy": "Следующий месяц", "Joriy oy": "Текущий месяц",
  /* ---- tarix (chat uslubi) ---- */
  "Oylik tarix": "История за месяц", "OYLIK HISOBOT": "ОТЧЁТ ЗА МЕСЯЦ", "Pul oqimi": "Денежный поток",
  "Tushum va xarajatlar farqi": "Разница доходов и расходов", "Xarajatlar": "Расходы", "Tushumlar": "Доходы",
  "Hammasi": "Все", "Filtr": "Фильтр", "Tartibni almashtirish": "Сменить порядок",
  "Yangidan eskiga": "От новых к старым", "Eskidan yangiga": "От старых к новым", "Bugun": "Сегодня", "Kecha": "Вчера",
  "{n} ta operatsiya": "Операций: {n}", "Hech narsa topilmadi": "Ничего не найдено",
  "Tanlangan filtr bo'yicha operatsiya yo'q.": "По выбранному фильтру операций нет.",
  "Bu oyda operatsiyalar yo'q": "В этом месяце операций нет",
  "Tushum yoki xarajat qo'shsangiz, kunlar shu yerda avtomatik paydo bo'ladi.": "Добавьте доход или расход — дни появятся здесь автоматически.",
  /* ---- asosiy ---- */
  "Jami tushum": "Общий доход", "Jami xarajat": "Общие расходы", "Oylik farq": "Разница за месяц",
  "Shu oyda kelib tushgan": "Поступило за этот месяц", "Shu oyda sarflangan": "Потрачено за этот месяц",
  "Tushum minus xarajat": "Доход минус расходы",
  "Xarajat": "Расход", "Tushum": "Доход", "Farq": "Разница",
  "So'nggi operatsiyalar": "Последние операции", "{n} ta tranzaksiya": "Операций: {n}", "Tanlangan oy bo'yicha": "За выбранный месяц",
  "Barchasi": "Все", "Tahrirlash": "Редактировать", "O'chirish": "Удалить", "Kategoriya": "Категория",
  "Hozircha operatsiyalar yo'q": "Пока нет операций", "Birinchi tushum yoki xarajatingizni kiriting.": "Добавьте первый доход или расход.",
  "Bugungi xarajat": "Расходы сегодня", "Faqat bugungi kun": "Только за сегодня", "Bugun qayd etilgan jami xarajat": "Всего расходов, записанных сегодня",
  "Xarajatlar tarkibi": "Структура расходов", "Eng ko'p sarflangan yo'nalishlar": "Самые затратные направления",
  "Xarajat qo'shilgach, tahlil shu yerda ko'rinadi.": "После добавления расходов здесь появится анализ.",
  /* ---- hisobot ---- */
  "Oylik statistika": "Месячная статистика", "Kalendar": "Календарь",
  "Kategoriyalar bo'yicha xarajat": "Расходы по категориям", "Vizual taqsimot va foizlar": "Наглядное распределение и проценты",
  "Batafsil ro'yxat": "Подробный список", "Statistika uchun ma'lumot yetarli emas.": "Недостаточно данных для статистики.",
  "Oylik ko'rsatkichlar": "Показатели месяца", "Kunlik o'rtacha xarajat": "Средний расход в день", "Shu oy bo'yicha": "За этот месяц",
  "Eng katta xarajat": "Самый крупный расход", "Bir operatsiya": "Одна операция", "Tranzaksiyalar": "Операции", "Jami qaydlar": "Всего записей",
  "Kunlik kalendar": "Календарь по дням", "Sanani tanlab, o'sha kundagi operatsiyalarni ko'ring": "Выберите дату, чтобы увидеть операции за этот день",
  "Kunlik moliyaviy natija": "Финансовый итог дня", "Izoh yo'q": "Без комментария", "Bu sana uchun operatsiyalar yo'q.": "На эту дату операций нет.",
  "JAMI": "ВСЕГО", "Xarajat qo'shilgach, diagramma shu yerda ko'rinadi.": "После добавления расходов здесь появится диаграмма.",
  "Kategoriyalar bo'yicha xarajat diagrammasi": "Диаграмма расходов по категориям",
  "Du": "Пн", "Se": "Вт", "Ch": "Ср", "Pa": "Чт", "Ju": "Пт", "Sh": "Сб", "Ya": "Вс",
  /* ---- qarzlar ---- */
  "Qarzlar nazorati": "Учёт долгов", "Qarzlar oddiy tushum va xarajatlardan alohida yuritiladi": "Долги ведутся отдельно от обычных доходов и расходов",
  "Qarz qo'shish": "Добавить долг", "Men bergan qarzlar": "Долги, которые я дал", "Men olgan qarzlar": "Долги, которые я взял",
  "Boshlang'ich": "Начальная сумма", "To'liq yopilgan": "Полностью закрыт", "Qisman qaytarilgan": "Частично возвращён", "Ochiq qarz": "Открытый долг",
  "Qoldiq": "Остаток", "To'lovlar tarixi": "История платежей", "To'lov": "Платёж", "To'lov kiritish": "Внести платёж",
  "Hozircha qarzlar yo'q": "Пока нет долгов", "Bergan yoki olgan qarzingizni qayd eting.": "Запишите долг, который вы дали или взяли.",
  /* ---- profil ---- */
  "Profil va sozlamalar": "Профиль и настройки", "Hisobingiz va ma'lumotlaringizni boshqaring": "Управляйте аккаунтом и данными",
  "Ma'lumotlar ushbu qurilmada saqlanadi. Telegram va PostgreSQL bilan sinxronlash uchun server sozlamalari kerak.": "Данные хранятся на этом устройстве. Для синхронизации с Telegram и PostgreSQL нужны настройки сервера.",
  "Admin panelga qaytish": "Вернуться в админ-панель", "Admin panel": "Админ-панель",
  "Foydalanuvchi": "Пользователь", "Mahalliy sinov profili": "Локальный тестовый профиль", "Demo": "Демо",
  "Kategoriyalar": "Категории", "Daromad va xarajat turlarini boshqaring": "Управляйте видами доходов и расходов", "Qo'shish": "Добавить",
  "Maxfiylik": "Конфиденциальность", "Ma'lumotlaringizni boshqa foydalanuvchi bilan ulashmang.": "Не делитесь своими данными с другими пользователями.",
  "Mahalliy ma'lumotlarni tozalash": "Очистить локальные данные", "Bu amal qaytarilmaydi.": "Это действие необратимо.", "Tozalash": "Очистить",
  "Barcha mahalliy ma'lumotlar o'chirilsinmi?": "Удалить все локальные данные?", "Mahalliy ma'lumotlar tozalandi": "Локальные данные очищены",
  "Til": "Язык", "Ilova va bot tilini tanlang": "Выберите язык приложения и бота", "O'zbekcha": "O'zbekcha", "Русский": "Русский",
  /* ---- modal ---- */
  "Xarajat qo'shish": "Добавить расход", "Tushum qo'shish": "Добавить доход", "Tranzaksiyani tahrirlash": "Редактировать операцию",
  "Kategoriya qo'shish": "Добавить категорию", "Qaytarilgan to'lov": "Возвращённый платёж", "Yopish": "Закрыть", "Sana": "Дата",
  "Summa (so'm)": "Сумма (сум)", "Izoh (ixtiyoriy)": "Комментарий (необязательно)", "Masalan, tushlik yoki yo'l kira": "Например, обед или проезд",
  "Saqlanmoqda...": "Сохранение...", "O'zgarishlarni saqlash": "Сохранить изменения", "Tushumni saqlash": "Сохранить доход", "Xarajatni saqlash": "Сохранить расход",
  "Tranzaksiyani o'chirish": "Удалить операцию", "Ushbu tranzaksiyani o'chirmoqchimisiz?": "Удалить эту операцию?",
  "Shaxs ismi": "Имя человека", "Masalan, Azizbek": "Например, Азизбек", "Qarz turi": "Тип долга", "Men bergan qarz": "Я дал в долг", "Men olgan qarz": "Я взял в долг",
  "Qaytarish sanasi": "Срок возврата", "Qo'shimcha ma'lumot": "Дополнительная информация", "Qarzni saqlash": "Сохранить долг",
  "Kategoriya turi": "Тип категории", "Kategoriya nomi": "Название категории", "Yangi kategoriya": "Новая категория",
  "Qaytarilgan summa (so'm)": "Возвращённая сумма (сум)", "To'lovni saqlash": "Сохранить платёж",
  /* ---- xabarlar ---- */
  "Tranzaksiya yangilandi": "Операция обновлена", "Tranzaksiya saqlandi": "Операция сохранена", "Tranzaksiya o'chirildi": "Операция удалена",
  "Qarz saqlandi": "Долг сохранён", "Qisman to'lov saqlandi": "Частичный платёж сохранён", "Kategoriya qo'shildi": "Категория добавлена",
  /* ---- xatolar ---- */
  "Kategoriyani tanlang.": "Выберите категорию.", "Tanlangan kategoriya mos emas.": "Выбранная категория не подходит.",
  "Ma'lumotlarni tekshiring.": "Проверьте данные.", "Shaxs ismini kiriting.": "Введите имя человека.", "Qarz topilmadi.": "Долг не найден.",
  "To'lov qolgan qarzdan katta bo'lishi mumkin emas.": "Платёж не может превышать остаток долга.",
  "Kategoriya nomini kiriting.": "Введите название категории.", "Bu kategoriya allaqachon mavjud.": "Такая категория уже существует.",
  "Summa noldan katta bo'lishi kerak.": "Сумма должна быть больше нуля.",
  "Telegram foydalanuvchisi bloklangan.": "Пользователь Telegram заблокирован.", "Hisobingiz bloklangan.": "Ваш аккаунт заблокирован.",
  "Server ma'lumotlarini yuklab bo'lmadi.": "Не удалось загрузить данные с сервера.",
  "Server bazasiga ulanib bo'lmadi. Ma'lumotlar serverga saqlanmayapti. Internet va server sozlamalarini tekshiring.": "Не удалось подключиться к серверу. Данные не сохраняются. Проверьте интернет и настройки сервера.",
  "Telegram Mini App sessiyasi topilmadi. Brauzer rejimida serverga saqlash yoqilmagan.": "Сессия Telegram Mini App не найдена. В режиме браузера сохранение на сервер отключено.",
  "Mahalliy ma'lumotlarni o'qib bo'lmadi; avtomatik ustidan yozish to'xtatildi.": "Не удалось прочитать локальные данные; автоматическая перезапись остановлена.",
  "Telegram sessiyasi yo'q; serverga saqlash bajarilmadi.": "Нет сессии Telegram; сохранение на сервер не выполнено.",
  "Serverga saqlash bajarilmadi.": "Не удалось сохранить на сервер.", "Saqlangan ma'lumotlarni qayta tekshirish bajarilmadi.": "Не удалось перепроверить сохранённые данные.",
  "Serverga saqlash xatosi": "Ошибка сохранения на сервер", "noma'lum xato": "неизвестная ошибка",
  "Brauzer xotirasiga saqlash amalga oshmadi. Telegram Mini App orqali serverga kiring.": "Не удалось сохранить в память браузера. Войдите на сервер через Telegram Mini App.",
  "Telegram sessiyasi topilmadi.": "Сессия Telegram не найдена.", "Foydalanuvchi topilmadi.": "Пользователь не найден.",
  "Kirish muddati tugagan. Ilovani qayta oching.": "Срок входа истёк. Откройте приложение заново.",
  "Telegram imzosi tekshiruvdan o'tmadi.": "Подпись Telegram не прошла проверку.", "Telegram ma'lumotlari noto'g'ri.": "Данные Telegram некорректны.",
  "Telegram autentifikatsiyasi sozlanmagan.": "Аутентификация Telegram не настроена.",
  "So'rov bajarilmadi.": "Запрос не выполнен.", "Ruxsat yo'q.": "Нет доступа.",
  /* ---- bannerlar ---- */
  "🛠 Botda texnik ishlar ketmoqda.": "🛠 В боте идут технические работы.", "🛠 Texnik ishlar ketmoqda.": "🛠 Идут технические работы.",
  /* ---- AI ilova ---- */
  "SHAXSIY MOLIYAVIY YORDAMCHI": "ЛИЧНЫЙ ФИНАНСОВЫЙ ПОМОЩНИК", "Hisobchi AI": "Хисобчи ИИ",
  "Qisqa, aniq va sizning raqamlaringizga asoslangan maslahat.": "Краткие и точные советы на основе ваших цифр.",
  "Suhbat tarixini tozalash": "Очистить историю чата",
  "AI provayderlari sozlanmagan. Serverning": "Провайдеры ИИ не настроены. В файл", "fayliga GEMINI_API_KEY yoki GROQ_API_KEY qo'shing.": "сервера добавьте GEMINI_API_KEY или GROQ_API_KEY.",
  "Maslahat": "Совет", "Tahlil": "Анализ", "Maqsad": "Цель", "Xotira": "Память",
  "Tezkor xulosa": "Быстрый вывод", "AI'siz, bepul": "Без ИИ, бесплатно",
  "Nimani bilmoqchisiz?": "Что хотите узнать?", "Pastdagi tayyor savollardan birini bosing yoki o'zingiz yozing.": "Нажмите на готовый вопрос ниже или напишите свой.",
  "Xayrli tun": "Доброй ночи", "Xayrli tong": "Доброе утро", "Xayrli kun": "Добрый день", "Xayrli kech": "Добрый вечер",
  "Moliyaviy yordamchi": "Финансовый помощник", "Asosiy menyuga qaytish": "Вернуться в главное меню", "Menyu": "Меню",
  "Pulingiz qayerga ketayotganini birga tahlil qilamiz.": "Вместе разберём, куда уходят ваши деньги.",
  "Eshitilmoqda...": "Слушаю...", "Tezkor savollar": "Быстрые вопросы", "Moliya rejimi": "Режим финансов", "Ovozli kiritish": "Голосовой ввод",
  "AI xato qilishi mumkin. Muhim qarorlarni tekshirib oling.": "ИИ может ошибаться. Проверяйте важные решения.",
  "Nusxalash": "Копировать", "Agar... bo'lsa?": "А что если...?", "Savolingizni yozing...": "Напишите свой вопрос...", "Xabar yuborish": "Отправить сообщение",
  "Moliyaviy sog'liq bali": "Балл финансового здоровья", "Ball hisoblash uchun kamida 5 ta operatsiya kiriting.": "Для расчёта балла добавьте минимум 5 операций.",
  "Bugun xavfsiz sarflash limiti": "Безопасный лимит трат на сегодня", "so'm / kun": "сум / день",
  "Bu oy xarajat kutilgan daromaddan oshib ketdi — yangi xarajatlarni minimal tuting.": "Расходы в этом месяце превысили ожидаемый доход — старайтесь минимизировать новые траты.",
  "Oy oxirigacha {days} kun, {left} so'm qoldi. Hozirgi o'rtacha: {avg} so'm/kun": "До конца месяца {days} дн., осталось {left} сум. Текущий средний расход: {avg} сум/день",
  " — limitdan yuqori.": " — выше лимита.", " — joyida.": " — в норме.",
  "Daromad kiritilgach limit hisoblanadi.": "Лимит рассчитывается после добавления дохода.",
  "Odatdan tashqari xarajatlar": "Необычные расходы", "Hozircha g'ayrioddiy xarajat topilmadi.": "Необычных расходов пока не найдено.",
  "AI bilan muhokama qilish": "Обсудить с ИИ", "\"Agar... bo'lsa?\" simulyatori": "Симулятор «А что если...?»",
  "Xarajatni kamaytirsam": "Если сократить расходы", "Daromadni oshirsam": "Если увеличить доход", "Oyiga": "В месяц", "1 yilda": "За 1 год", "5 yilda": "За 5 лет",
  "O'rtacha oylik xarajat {exp}, daromad {inc} so'm asosida. Narx o'zgarmaydi va foiz qo'shilmaydi, deb faraz qilingan.": "Расчёт на основе среднемесячных расходов {exp} и доходов {inc} сум. Предполагается, что цены не меняются и проценты не начисляются.",
  "Hisoblash uchun operatsiyalar kerak.": "Для расчёта нужны операции.",
  "Menga qaytishi kerak": "Мне должны вернуть", "Men qaytarishim kerak": "Я должен вернуть", "{n} qaytgan": "возвращено {n}", "{n} qaytargan": "возвращено мной {n}",
  "Muddati o'tgan qarzlar: {n} ta.": "Просроченные долги: {n}.", "Qarzlar yo'q": "Долгов нет",
  "«Qarzlar» bo'limida qarz qo'shsangiz, shu yerda ismlar bilan ko'rinadi.": "Если добавите долг в разделе «Долги», он появится здесь с именами.",
  "Ismlar va qarzlar": "Имена и долги", "Men bergan": "Я дал", "Men olgan": "Я взял", "Berilgan": "Дано", "Qaytdi": "Вернули", "Qaytardim": "Вернул", "Qoldi": "Осталось",
  "✅ To'liq yopilgan": "✅ Полностью закрыт", "⚠️ Muddati o'tgan: ": "⚠️ Просрочен: ", "Muddat: ": "Срок: ", "Muddat belgilanmagan": "Срок не указан",
  "Nusxalandi ✓": "Скопировано ✓", "Eslatma matnini nusxalash": "Копировать текст напоминания", "Telegramda yuborish": "Отправить в Telegram",
  "AI bilan qarzlarni tahlil qilish": "Проанализировать долги с ИИ",
  "Moliyaviy maqsadlar": "Финансовые цели", "Maqsad qo'shsangiz, AI darhol tejash rejasini tuzib beradi.": "Добавьте цель — ИИ сразу составит план накоплений.",
  "{n} so'm yig'ilgan ({pct}%)": "накоплено {n} сум ({pct}%)", "Muddat yo'q": "Без срока",
  "Muddat o'tgan — {n} so'm qoldi": "Срок истёк — осталось {n} сум",
  "Kuniga ≈ {day} so'm · oyiga ≈ {month} so'm kerak ({days} kun qoldi)": "Нужно ≈ {day} сум в день · ≈ {month} сум в месяц (осталось {days} дн.)",
  "AI reja": "План от ИИ", "Summani yangilash": "Обновить сумму", "Maqsadni saqlash": "Сохранить цель",
  "Masalan: Favqulodda jamg'arma": "Например: Резервный фонд", "Summa (so'm) ": "Сумма (сум)", "Maqsad muddati": "Срок цели", "Maqsad muddati ": "Срок цели",
  "Shaxsiy xotira": "Личная память", "Yoqilgan": "Включена", "O'chirilgan": "Выключена",
  "AI sizning maqsad va afzalliklaringizni har suhbatda hisobga oladi. Faqat siz yozganingiz ishlatiladi.": "ИИ учитывает ваши цели и предпочтения в каждом разговоре. Используется только то, что вы написали.",
  "Xotiradan foydalanishga roziman": "Согласен использовать память", "Men uchun muhim narsalar": "Что для меня важно",
  "Masalan: 6 oyda favqulodda jamg'arma yig'moqchiman. Daromadim o'zgaruvchan.": "Например: хочу накопить резервный фонд за 6 месяцев. Мой доход нестабильный.",
  "Saqlash": "Сохранить", "Karta raqami, parol yoki boshqa maxfiy ma'lumot yozmang.": "Не указывайте номер карты, пароль и другие секретные данные.",
  "AI maslahatchi uchun Telegram Mini App ichidan kirish kerak. Brauzer preview rejimida shaxsiy ma'lumotlarga ruxsat berilmaydi.": "Для ИИ-помощника нужно войти через Telegram Mini App. В режиме просмотра в браузере доступ к личным данным закрыт.",
  "AI yuklanmadi.": "Не удалось загрузить ИИ.", "AI javob bermadi.": "ИИ не ответил.", "Xotira saqlanmadi.": "Память не сохранена.", "Maqsad saqlanmadi.": "Цель не сохранена.",
  "Maqsad yangilanmadi.": "Цель не обновлена.", "Maqsad o'chirilmadi.": "Цель не удалена.", "Tarix o'chirilmadi.": "История не удалена.",
  "«{title}» uchun hozirgacha yig'ilgan summani kiriting (so'm):": "Введите накопленную на данный момент сумму для «{title}» (сум):",
  "Yig'ilgan summa 0 yoki undan katta son bo'lishi kerak.": "Накопленная сумма должна быть числом не меньше 0.",
  "«{title}» maqsadi o'chirilsinmi?": "Удалить цель «{title}»?", "AI suhbat tarixini o'chirishni tasdiqlaysizmi? Bu amal qaytarilmaydi.": "Подтверждаете удаление истории чата с ИИ? Это действие необратимо.",
  "Sog'liq bali": "Балл здоровья",
};

export function t(lang: Lang, key: string, params?: Record<string, string | number>): string {
  let out = lang === "ru" ? (RU_N.get(norm(key)) ?? key) : key;
  if (params) for (const [k, v] of Object.entries(params)) out = out.split(`{${k}}`).join(String(v));
  return out;
}
const RU_N = new Map<string, string>(Object.entries(RU).map(([k, v]) => [norm(k), v]));

/** Standart kategoriyalar bazada o'zbekcha saqlanadi; ko'rsatishda tilga qarab almashtiriladi. */
const CAT_RU: Record<string, string> = {
  "Ovqatlanish": "Питание", "Oziq-ovqat": "Продукты", "Transport": "Транспорт", "Uy-joy": "Жильё", "Kiyim-kechak": "Одежда",
  "Ta'lim": "Образование", "Sog'liq": "Здоровье", "Ko'ngilochar": "Развлечения", "Boshqa": "Другое",
  "Ish haqi": "Зарплата", "Qo'shimcha ish": "Подработка", "Freelance": "Фриланс", "Savdo": "Торговля", "Sovg'a": "Подарок", "Boshqa tushum": "Прочие доходы",
};
const CAT_N = new Map(Object.entries(CAT_RU).map(([k, v]) => [norm(k), v]));
export const catName = (lang: Lang, name: string) => (lang === "ru" ? CAT_N.get(norm(name)) ?? name : name);

export const currencyWord = (lang: Lang) => (lang === "ru" ? "сум" : "so‘m");
export function formatNum(value: number | string, lang: Lang = "uz"): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat(localeOf(lang), { maximumFractionDigits: 0 }).format(n).replace(/[\u00a0\u202f]/g, " ");
}
export const formatMoney = (value: number | string, lang: Lang = "uz") => `${formatNum(value, lang)} ${currencyWord(lang)}`;
