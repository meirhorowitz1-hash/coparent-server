import { z } from 'zod';

export const languageEnum = z.enum(['en', 'he', 'es', 'fr', 'de']);
export const currencyEnum = z.enum(['USD', 'EUR', 'GBP', 'ILS', 'CAD']);
export const timezoneEnum = z.string(); // e.g., 'Asia/Jerusalem', 'America/New_York'
export const dateFormatEnum = z.enum(['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD']);
export const timeFormatEnum = z.enum(['12h', '24h']);
export const weekStartEnum = z.enum(['sunday', 'monday']);

// User Settings
export const updateUserSettingsSchema = z.object({
  language: languageEnum.optional(),
  timezone: timezoneEnum.optional(),
  dateFormat: dateFormatEnum.optional(),
  timeFormat: timeFormatEnum.optional(),
  weekStart: weekStartEnum.optional(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
});

// Family Settings
export const updateFamilySettingsSchema = z.object({
  defaultCurrency: currencyEnum.optional(),
  expenseSplitDefault: z.enum(['equal', 'percentage', 'custom']).optional(),
  parent1Percentage: z.number().min(0).max(100).optional(),
  parent2Percentage: z.number().min(0).max(100).optional(),
  requireApprovalForExpenses: z.boolean().optional(),
  expenseApprovalThreshold: z.number().min(0).optional().nullable(),
  allowSwapRequests: z.boolean().optional(),
  requireApprovalForSwaps: z.boolean().optional(),
  reminderDefaultTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(), // HH:mm
  enableCalendarReminders: z.boolean().optional(),
  calendarReminderMinutes: z.number().min(0).optional(),
});

// Privacy Settings
export const updatePrivacySettingsSchema = z.object({
  profileVisibility: z.enum(['private', 'family', 'public']).optional(),
  shareCalendarWithCoParent: z.boolean().optional(),
  shareExpensesWithCoParent: z.boolean().optional(),
  shareDocumentsWithCoParent: z.boolean().optional(),
  allowCoParentMessaging: z.boolean().optional(),
  blockUser: z.string().uuid().optional(), // userId to block/unblock
  unblockUser: z.string().uuid().optional(),
});

// Finance Settings
export const updateFinanceSettingsSchema = z.object({
  defaultExpenseCategory: z.string().optional().nullable(),
  enableReceiptScanning: z.boolean().optional(),
  autoCalculateSplit: z.boolean().optional(),
  trackPaymentStatus: z.boolean().optional(),
  sendPaymentReminders: z.boolean().optional(),
  paymentReminderDays: z.number().min(1).max(30).optional(),
});

export type Language = z.infer<typeof languageEnum>;
export type Currency = z.infer<typeof currencyEnum>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
export type UpdateFamilySettingsInput = z.infer<typeof updateFamilySettingsSchema>;
export type UpdatePrivacySettingsInput = z.infer<typeof updatePrivacySettingsSchema>;
export type UpdateFinanceSettingsInput = z.infer<typeof updateFinanceSettingsSchema>;
