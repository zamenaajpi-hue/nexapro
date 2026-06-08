import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  nickname: z.string().min(2, 'Nickname must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phoneNumber: z.string().max(32).optional(),
  avatarColor: z.string().optional(),
  publicKey: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
