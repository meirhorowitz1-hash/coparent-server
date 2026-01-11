import { z } from 'zod';

// Send text message
export const sendMessageSchema = z.object({
  text: z.string().min(1).max(5000),
});

// Send image message
export const sendImageMessageSchema = z.object({
  imageData: z.string().min(1), // Base64 encoded
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  text: z.string().max(500).optional(), // Optional caption
});

// Send message (text or image)
export const sendAnyMessageSchema = z.object({
  text: z.string().max(5000).optional(),
  imageData: z.string().optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
}).refine(
  (data) => data.text || data.imageData,
  { message: 'Message must have either text or image' }
);

// Edit message
export const editMessageSchema = z.object({
  text: z.string().min(1).max(5000),
});

// Query params for listing messages
export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(), // Cursor for pagination
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendImageMessageInput = z.infer<typeof sendImageMessageSchema>;
export type SendAnyMessageInput = z.infer<typeof sendAnyMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
