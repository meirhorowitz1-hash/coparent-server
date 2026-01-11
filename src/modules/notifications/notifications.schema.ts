import { z } from 'zod';

export const notificationTypeEnum = z.enum([
  'expense_created',
  'expense_approved',
  'expense_rejected',
  'expense_paid',
  'swap_request_created',
  'swap_request_approved',
  'swap_request_rejected',
  'task_assigned',
  'task_completed',
  'calendar_event_created',
  'calendar_event_updated',
  'calendar_event_reminder',
  'document_shared',
  'chat_message',
  'family_invite',
  'system_announcement',
]);

export const notificationPriorityEnum = z.enum(['low', 'normal', 'high', 'urgent']);

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  familyId: z.string().uuid().optional().nullable(),
  type: notificationTypeEnum,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(500),
  priority: notificationPriorityEnum.default('normal'),
  data: z.record(z.any()).optional(),
  actionUrl: z.string().optional().nullable(),
  sendPush: z.boolean().default(true),
});

export const updateNotificationPreferencesSchema = z.object({
  expenseNotifications: z.boolean().optional(),
  swapRequestNotifications: z.boolean().optional(),
  taskNotifications: z.boolean().optional(),
  calendarNotifications: z.boolean().optional(),
  chatNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), // HH:mm
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
});

export const markAsReadSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1),
});

export const markAllAsReadSchema = z.object({
  familyId: z.string().uuid().optional(),
});

export type NotificationType = z.infer<typeof notificationTypeEnum>;
export type NotificationPriority = z.infer<typeof notificationPriorityEnum>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type MarkAllAsReadInput = z.infer<typeof markAllAsReadSchema>;
