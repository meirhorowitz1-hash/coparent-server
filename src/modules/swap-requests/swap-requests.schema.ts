import { z } from 'zod';

export const requestTypeEnum = z.enum(['swap', 'one-way']);
export const swapStatusEnum = z.enum(['pending', 'approved', 'rejected', 'cancelled']);

export const createSwapRequestSchema = z.object({
  originalDate: z.string().datetime(),
  proposedDate: z.string().datetime().optional().nullable(),
  requestType: requestTypeEnum.default('swap'),
  reason: z.string().max(500).optional().nullable(),
});

export const updateSwapStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
  responseNote: z.string().max(500).optional().nullable(),
});

export type CreateSwapRequestInput = z.infer<typeof createSwapRequestSchema>;
export type UpdateSwapStatusInput = z.infer<typeof updateSwapStatusSchema>;
