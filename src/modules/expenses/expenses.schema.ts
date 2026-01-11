import { z } from 'zod';

export const createExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  date: z.string().datetime(),
  notes: z.string().max(1000).optional().nullable(),
  splitParent1: z.number().min(0).max(100).default(50),
  receiptUrl: z.string().url().optional().nullable(),
  receiptName: z.string().max(200).optional().nullable(),
});

export const updateExpenseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  amount: z.number().positive().optional(),
  date: z.string().datetime().optional(),
  notes: z.string().max(1000).optional().nullable(),
  splitParent1: z.number().min(0).max(100).optional(),
  receiptUrl: z.string().url().optional().nullable(),
  receiptName: z.string().max(200).optional().nullable(),
});

export const updateExpenseStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

export const togglePaidSchema = z.object({
  isPaid: z.boolean(),
});

export const updateFinanceSettingsSchema = z.object({
  alimonyAmount: z.number().min(0).optional(),
  alimonyPayer: z.enum(['parent1', 'parent2']).optional().nullable(),
  defaultSplitParent1: z.number().min(0).max(100).optional(),
  fixedExpenses: z.array(z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    amount: z.number().positive(),
    splitParent1: z.number().min(0).max(100),
  })).optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type UpdateExpenseStatusInput = z.infer<typeof updateExpenseStatusSchema>;
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
