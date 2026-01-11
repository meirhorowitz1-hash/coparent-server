import { z } from 'zod';

export const CustodyOverrideTypeEnum = z.enum(['vacation', 'holiday', 'special', 'swap']);
export type CustodyOverrideType = z.infer<typeof CustodyOverrideTypeEnum>;

export const CustodyOverrideStatusEnum = z.enum(['pending', 'approved', 'rejected', 'cancelled']);
export type CustodyOverrideStatus = z.infer<typeof CustodyOverrideStatusEnum>;

export const createCustodyOverrideSchema = z.object({
  name: z.string().optional(),
  type: CustodyOverrideTypeEnum,
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  assignments: z.record(z.string(), z.enum(['parent1', 'parent2'])), // { "2024-01-15": "parent1" }
  note: z.string().optional(),
  requestApproval: z.boolean().optional().default(true),
  requestedByName: z.string().optional(),
});

export type CreateCustodyOverrideInput = z.infer<typeof createCustodyOverrideSchema>;

export const respondCustodyOverrideSchema = z.object({
  approve: z.boolean(),
  responseNote: z.string().optional(),
});

export type RespondCustodyOverrideInput = z.infer<typeof respondCustodyOverrideSchema>;
