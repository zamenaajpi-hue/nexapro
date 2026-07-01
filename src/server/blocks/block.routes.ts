import type { Express } from 'express';
import { authenticateUser } from '../middlewares/auth.middleware';
import { db } from '../../services/db';

export function registerBlockRoutes(app: Express) {
  app.get('/api/blocks', authenticateUser, async (req: any, res) => {
    const blocks = await db.userBlock.findMany({ where: { blockerId: req.userId }, select: { blockedId: true } });
    res.json({ userIds: blocks.map((block) => block.blockedId) });
  });

  app.post('/api/users/:id/block', authenticateUser, async (req: any, res) => {
    if (req.params.id === req.userId) return res.status(400).json({ error: 'Нельзя заблокировать себя' });
    const target = await db.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    await db.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: req.userId, blockedId: target.id } },
      update: {},
      create: { blockerId: req.userId, blockedId: target.id },
    });
    res.json({ blocked: true });
  });

  app.delete('/api/users/:id/block', authenticateUser, async (req: any, res) => {
    await db.userBlock.deleteMany({ where: { blockerId: req.userId, blockedId: req.params.id } });
    res.json({ blocked: false });
  });
}
