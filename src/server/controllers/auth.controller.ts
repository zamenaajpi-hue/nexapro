import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { registerSchema, loginSchema } from '../validations/auth.schema';
import { z } from 'zod';

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
      console.error(err);
      res.status(err.message === 'User already exists' ? 400 : 500).json({ error: err.message || 'Registration failed' });
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
