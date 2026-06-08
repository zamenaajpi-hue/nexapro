import { Request, Response } from 'express';
import { db } from '../../services/db';

export const pushController = {
  registerToken: async (req: Request | any, res: Response): Promise<void> => {
    try {
      const { token, subscription, platform } = req.body;
      const pushToken = typeof subscription === 'string'
        ? subscription
        : subscription
          ? JSON.stringify(subscription)
          : token;

      if (!pushToken) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      const userId = req.userId;

      // Upsert or create push token for this user
      await db.pushToken.upsert({
        where: { token: pushToken },
        update: { userId, platform: platform || 'android' },
        create: { token: pushToken, userId, platform: platform || 'android' }
      });

      res.json({ success: true, message: 'Push token registered successfully' });
    } catch (err: any) {
      console.error('[PUSH_ERR] Failed to register token:', err);
      res.status(500).json({ error: err.message || 'Failed to register push token' });
    }
  },

  unregisterToken: async (req: Request | any, res: Response): Promise<void> => {
    try {
      const { token, subscription } = req.body;
      const pushToken = typeof subscription === 'string'
        ? subscription
        : subscription
          ? JSON.stringify(subscription)
          : token;

      if (!pushToken) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      await db.pushToken.deleteMany({
        where: { token: pushToken, userId: req.userId }
      });

      res.json({ success: true, message: 'Push token unregistered successfully' });
    } catch (err: any) {
      console.error('[PUSH_ERR] Failed to unregister token:', err);
      res.status(500).json({ error: err.message || 'Failed to unregister push token' });
    }
  }
};
