import { z } from 'zod';

export const upsertMonthlySummarySchema = z.object({
  month: z.number().min(0).max(11),
  year: z.number().min(2020).max(2100),
  label: z.string(),
  totalApproved: z.number().default(0),
  parent1Share: z.number().default(0),
  parent2Share: z.number().default(0),
  approvedCount: z.number().int().default(0),
});

export type UpsertMonthlySummaryInput = z.infer<typeof upsertMonthlySummarySchema>;
