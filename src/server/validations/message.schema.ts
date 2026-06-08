import { z } from 'zod';

export const sendMessageSchema = z.object({
  to: z.string().min(1, 'Recipient ID is required'),
  text: z.string().max(2000, 'Message is too long').optional(),
  type: z.enum(['text', 'image', 'audio', 'video', 'sticker', 'file']).optional(),
  data: z.string().optional(),
  replyToId: z.string().optional()
});

export const messageHistorySchema = z.object({
  chatId: z.string().min(1)
});

export const messageReactionSchema = z.object({
  messageId: z.string().min(1),
  emoji: z.string().min(1).max(10)
});

export const messagePinSchema = z.object({
  messageId: z.string().min(1),
  isPinned: z.boolean()
});

export const messageSearchSchema = z.object({
  chatId: z.string().min(1),
  query: z.string().min(1)
});
