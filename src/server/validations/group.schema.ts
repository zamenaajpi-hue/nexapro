import { z } from 'zod';

export const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required').max(50),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  slug: z.string().optional(),
  members: z.array(z.string()).optional()
});

export const updateGroupSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  slug: z.string().optional(),
  avatarImage: z.string().nullable().optional()
});

export const createChannelSchema = z.object({
  name: z.string().min(1, 'Channel name is required').max(50),
  description: z.string().optional(),
  isPublic: z.boolean().optional()
  ,slug: z.string().optional()
});

export const updateChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  slug: z.string().optional(),
  avatarImage: z.string().nullable().optional()
});
