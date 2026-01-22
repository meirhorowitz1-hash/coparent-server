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
  updatedByName: z.string().max(100).optional(),
  // Appeal fields
  appealNote: z.string().max(1000).optional().nullable(),
  appealRequestedById: z.string().optional().nullable(),
  appealRequestedByName: z.string().max(100).optional().nullable(),
  appealRequestedAt: z.string().datetime().optional().nullable(),
  appealResponseNote: z.string().max(1000).optional().nullable(),
  appealRespondedById: z.string().optional().nullable(),
  appealRespondedByName: z.string().max(100).optional().nullable(),
  appealRespondedAt: z.string().datetime().optional().nullable(),
});

export const updateExpenseStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  rejectionNote: z.string().max(1000).optional().nullable(),
  updatedByName: z.string().max(100).optional(),
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
