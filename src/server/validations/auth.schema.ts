import { z } from 'zod';
import { RUSSIAN_PHONE_PATTERN, INVALID_RUSSIAN_PHONE_MESSAGE } from '../utils/phone';

const optionalRussianPhoneSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().regex(RUSSIAN_PHONE_PATTERN, INVALID_RUSSIAN_PHONE_MESSAGE).optional(),
);

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
  nickname: z.string().min(2, 'Nickname must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  cloudPassword: z.string().min(6, 'Cloud password must be at least 6 characters'),
  phoneNumber: optionalRussianPhoneSchema,
  avatarColor: z.string().optional(),
  publicKey: z.string().optional()
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  cloudPassword: z.string().min(6).optional()
});

export const googleAuthSchema = z.object({
  credential: z.string().min(20).optional(),
  accessToken: z.string().min(20).optional(),
  avatarColor: z.string().optional(),
}).refine((data) => data.credential || data.accessToken, {
  message: 'Google token is required',
});
