import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { registerSchema, loginSchema } from '../validations/auth.schema';
import { z } from 'zod';

const duplicateMessage = (err: any) => {
  if (err?.code !== 'P2002') return null;
  const target = Array.isArray(err?.meta?.target) ? err.meta.target : [];
  if (target.includes('normalizedPhone')) return 'Этот номер телефона уже привязан к другому аккаунту';
  if (target.includes('email')) return 'Пользователь с такой почтой уже существует';
  if (target.includes('nickname')) return 'Этот никнейм уже занят';
  return 'Такие данные уже используются другим аккаунтом';
};

export const authController = {
  register: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = registerSchema.parse(req.body);
      const result = await authService.register(data);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
         res.status(400).json({ error: 'Validation Error', details: err.issues });
         return;
      }
      const duplicate = duplicateMessage(err);
      if (duplicate) {
        res.status(400).json({ error: duplicate });
        return;
      }
      const knownMessages = [
        'Пользователь с такой почтой уже существует',
        'Этот никнейм уже занят',
        'Этот номер телефона уже привязан к другому аккаунту',
      ];
      if (knownMessages.includes(err.message)) {
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
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
         res.status(400).json({ error: 'Validation Error', details: err.issues });
         return;
      }
      res.status(err.message === 'Invalid credentials' ? 401 : 500).json({ error: err.message || 'Login failed' });
    }
  }
};
