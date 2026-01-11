import { z } from 'zod';

// Create payment receipt
export const createPaymentReceiptSchema = z.object({
  month: z.number().int().min(0).max(11),
  year: z.number().int().min(2020).max(2100),
  imageUrl: z.string().min(1), // Base64 or URL
  imageName: z.string().optional(),
  amount: z.number().positive().optional(),
  paidTo: z.enum(['parent1', 'parent2']),
  description: z.string().max(500).optional(),
});

// Update payment receipt
export const updatePaymentReceiptSchema = z.object({
  amount: z.number().positive().optional(),
  description: z.string().max(500).optional(),
});

// Query params for listing
export const listPaymentReceiptsQuerySchema = z.object({
  year: z.coerce.number().int().min(2020).max(2100).optional(),
  month: z.coerce.number().int().min(0).max(11).optional(),
});

export type CreatePaymentReceiptInput = z.infer<typeof createPaymentReceiptSchema>;
export type UpdatePaymentReceiptInput = z.infer<typeof updatePaymentReceiptSchema>;
export type ListPaymentReceiptsQuery = z.infer<typeof listPaymentReceiptsQuerySchema>;
