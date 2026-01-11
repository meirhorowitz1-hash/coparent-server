import { z } from 'zod';

export const createFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export const updateFamilySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  photoUrl: z.string().url().optional().nullable(),
});

export const inviteCoParentSchema = z.object({
  email: z.string().email(),
});

export const joinByCodeSchema = z.object({
  shareCode: z.string().length(6),
});

export const addChildSchema = z.object({
  name: z.string().min(1).max(100),
  birthDate: z.string().datetime().optional(),
  photoUrl: z.string().url().optional().nullable(),
});

export const updateChildSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  birthDate: z.string().datetime().optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;
export type InviteCoParentInput = z.infer<typeof inviteCoParentSchema>;
export type JoinByCodeInput = z.infer<typeof joinByCodeSchema>;
export type AddChildInput = z.infer<typeof addChildSchema>;
export type UpdateChildInput = z.infer<typeof updateChildSchema>;
