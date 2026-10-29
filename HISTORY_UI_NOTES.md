# Premium monthly transaction history

The `Tarix` tab adds a Telegram Mini App-friendly month-by-month ledger:

- Navigate backward and forward through every month and jump back to the current month.
- See monthly income, expenses, and net difference at the top.
- Review every transaction for the selected month, grouped by compact date headers.
- Expenses are displayed in the left lane and income in the right lane on larger mobile screens.
- Tap any transaction to open the existing edit dialog; updates and deletion use the app's existing save flow.
- Responsive layout stacks the two lanes on very narrow screens.

Run as usual with `npm ci`, configure `.env` using `.env.example`, then follow the project's README for database setup and `npm run dev`.

## v2 — chat-style ledger
- "Tarix" endi Telegram chat uslubida: xarajat chapda, tushum o'ngda, kunlar kichik pill ko'rinishida (kunlik jami bilan).
- Filtr (Hammasi / Xarajatlar / Tushumlar) va tartib almashtirish (eski↔yangi).
- Har bir pufakni bosish → tahrirlash oynasi (saqlash va o'chirish shu yerda).
- UZ/RU tarjimalari qo'shilgan.
