import { z } from "zod";
export const transactionSchema = z.object({
  amount: z.coerce.number().finite().positive("Summa noldan katta bo‘lishi kerak."),
  type: z.enum(["INCOME","EXPENSE"]),
  categoryId: z.string().min(1, "Kategoriyani tanlang."),
  note: z.string().max(500).optional(),
  occurredAt: z.coerce.date(),
  accountId: z.string().optional(),
  requestKey: z.string().max(100).optional()
});
export const debtSchema = z.object({
  personName: z.string().trim().min(1).max(120),
  direction: z.enum(["LENT","BORROWED"]),
  originalAmount: z.coerce.number().finite().positive(),
  occurredAt: z.coerce.date(),
  dueAt: z.coerce.date().optional(),
  note: z.string().max(500).optional()
});