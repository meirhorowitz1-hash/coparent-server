import { z } from 'zod';

export const eventTypeEnum = z.enum([
  'custody', 'pickup', 'dropoff', 'school', 
  'activity', 'medical', 'holiday', 'vacation', 'other'
]);

export const parentIdEnum = z.enum(['parent1', 'parent2', 'both']);

export const custodyPatternEnum = z.enum([
  'weekly', 'biweekly', 'custom', 'week_on_week_off'
]);

export const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  type: eventTypeEnum.default('other'),
  parentId: parentIdEnum.default('both'),
  color: z.string().max(20).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  reminderMinutes: z.number().int().min(0).optional().nullable(),
  isAllDay: z.boolean().default(false),
  childId: z.union([
    z.string().uuid(),
    z.literal(''),
    z.null(),
    z.undefined()
  ]).optional().transform(val => (!val || val === '') ? null : val),
});

export const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  type: eventTypeEnum.optional(),
  parentId: parentIdEnum.optional(),
  color: z.string().max(20).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  reminderMinutes: z.number().int().min(0).optional().nullable(),
  isAllDay: z.boolean().optional(),
  childId: z.union([
    z.string().uuid(),
    z.literal(''),
    z.null(),
    z.undefined()
  ]).optional().transform(val => (!val || val === '') ? null : val),
});

export const custodyScheduleSchema = z.object({
  name: z.string().max(100).optional().nullable(),
  pattern: custodyPatternEnum,
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  parent1Days: z.array(z.number().int().min(0).max(6)),
  parent2Days: z.array(z.number().int().min(0).max(6)),
  biweeklyAltParent1Days: z.array(z.number().int().min(0).max(6)).optional().default([]),
  biweeklyAltParent2Days: z.array(z.number().int().min(0).max(6)).optional().default([]),
  isActive: z.boolean().default(true),
  requestApproval: z.boolean().optional().default(false),
});

export const approvalResponseSchema = z.object({
  approve: z.boolean(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type CustodyScheduleInput = z.infer<typeof custodyScheduleSchema>;
