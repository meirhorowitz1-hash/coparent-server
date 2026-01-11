import { z } from 'zod';

// Daily Goal Schema
export const dailyGoalSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2).max(200),
  icon: z.string().max(10).optional().nullable(),
  order: z.number().int().min(0).default(0),
});

// Create Goal Table Schema
export const createGoalTableSchema = z.object({
  childId: z.string().min(1),
  childName: z.string().min(1),
  title: z.string().min(2).max(200),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  goals: z.array(dailyGoalSchema).min(1),
});

// Update Goal Table Schema
export const updateGoalTableSchema = z.object({
  childId: z.string().min(1).optional(),
  childName: z.string().min(1).optional(),
  title: z.string().min(2).max(200).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  goals: z.array(dailyGoalSchema).min(1).optional(),
});

// Create/Update Daily Progress Schema
export const upsertDailyProgressSchema = z.object({
  date: z.string().datetime(),
  completedGoals: z.array(z.string()),
  notes: z.string().max(500).optional().nullable(),
});

export type DailyGoalInput = z.infer<typeof dailyGoalSchema>;
export type CreateGoalTableInput = z.infer<typeof createGoalTableSchema>;
export type UpdateGoalTableInput = z.infer<typeof updateGoalTableSchema>;
export type UpsertDailyProgressInput = z.infer<typeof upsertDailyProgressSchema>;
