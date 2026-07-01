import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { googleAuthSchema, loginSchema, registerSchema } from '../validations/auth.schema';
import { z } from 'zod';
import { INVALID_RUSSIAN_PHONE_MESSAGE } from '../utils/phone';
import { setAuthCookie } from '../utils/sessionCookie';

const duplicateMessage = (err: any) => {
  if (err?.code !== 'P2002') return null;
  const target = Array.isArray(err?.meta?.target) ? err.meta.target : [];
  if (target.includes('normalizedPhone')) return 'Этот номер телефона уже привязан к другому аккаунту';
  if (target.includes('googleSub')) return 'Этот Google аккаунт уже привязан к другому пользователю';
  if (target.includes('email')) return 'Пользователь с такой почтой уже существует';
  if (target.includes('nickname')) return 'Этот никнейм уже занят';
  return 'Такие данные уже используются другим аккаунтом';
};

const validationError = (err: z.ZodError) => ({
  error: err.issues[0]?.message || 'Validation Error',
  details: err.issues,
});

const isKnownRegistrationError = (message?: string) => [
  'Этот никнейм уже занят',
  INVALID_RUSSIAN_PHONE_MESSAGE,
].includes(message || '') || Boolean(message && (
  message.startsWith('Эта почта уже привязана к аккаунту @') ||
  message.startsWith('Этот номер телефона уже привязан к аккаунту @') ||
  message === 'Пользователь с такой почтой уже существует' ||
  message === 'Этот номер телефона уже привязан к другому аккаунту'
));

export const authController = {
  register: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      setAuthCookie(res, result.token);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json(validationError(err));
        return;
      }
      const duplicate = duplicateMessage(err);
      if (duplicate) {
        res.status(400).json({ error: duplicate });
        return;
      }
      if (isKnownRegistrationError(err.message)) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(500).json({ error: 'Registration failed' });
    }
  },

  login: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = loginSchema.parse(req.body);
      const result = await authService.login(data);
      if ('requiresCloudPassword' in result) {
        res.json(result);
        return;
      }
      setAuthCookie(res, result.token);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json(validationError(err));
        return;
      }
      if (err.message === 'Invalid credentials' || err.message === 'Invalid cloud password') {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      console.error(err);
      res.status(500).json({ error: 'Login failed' });
    }
  },

  google: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = googleAuthSchema.parse(req.body);
      const result = await authService.googleLogin(data);
      setAuthCookie(res, result.token);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json(validationError(err));
        return;
      }
      if (err.message === 'Google sign-in is not configured') {
        res.status(503).json({ error: err.message });
        return;
      }
      if (err.message === 'Google account email is not verified') {
        res.status(401).json({ error: err.message });
        return;
      }
      const duplicate = duplicateMessage(err);
      if (duplicate) {
        res.status(400).json({ error: duplicate });
        return;
      }
      if (err.message === 'This email is already linked to another Google account') {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error(err);
      res.status(401).json({ error: 'Google sign-in failed' });
    }
  },
};
