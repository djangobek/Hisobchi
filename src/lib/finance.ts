export type Tx = { amount: number; type: "INCOME" | "EXPENSE"; occurredAt: string | Date; category?: string; note?: string };
export function summarize<T extends Tx>(transactions: T[], year: number, monthIndex: number) {
  const rows = transactions.filter(t => { const d = new Date(t.occurredAt); return d.getFullYear()===year && d.getMonth()===monthIndex; });
  const income = rows.filter(t=>t.type==="INCOME").reduce((s,t)=>s+t.amount,0);
  const expenses = rows.filter(t=>t.type==="EXPENSE").reduce((s,t)=>s+t.amount,0);
  return { income, expenses, difference: income-expenses, transactions: rows };
}
export function summarizeDay<T extends Tx>(transactions: T[], date: Date) {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  const rows = transactions.filter(t=>{const d=new Date(t.occurredAt);return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`===key;});
  const income=rows.filter(t=>t.type==="INCOME").reduce((s,t)=>s+t.amount,0);
  const expenses=rows.filter(t=>t.type==="EXPENSE").reduce((s,t)=>s+t.amount,0);
  return {income,expenses,difference:income-expenses,transactions:rows};
}
export function debtRemaining(original: number, repayments: number[]) {
  const paid = repayments.reduce((s,n)=>s+n,0);
  return {paid, remaining: Math.max(0, original-paid), overpaid: paid>original};
}