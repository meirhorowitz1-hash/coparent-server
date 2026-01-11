import { z } from 'zod';

export const createUserSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  calendarColor: z.string().max(20).optional().nullable(),
});

export const updateUserSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
  calendarColor: z.string().max(20).optional().nullable(),
  activeFamilyId: z.string().uuid().optional().nullable(),
});

export const addPushTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['web', 'ios', 'android']).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AddPushTokenInput = z.infer<typeof addPushTokenSchema>;
