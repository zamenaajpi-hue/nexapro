import type { Express, Request } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { authenticateUser } from '../middlewares/auth.middleware';
import { getJwtSecret } from '../config/auth';
import { db } from '../../services/db';
import { inviteIsUsable, isSlugAvailable, newInviteCode, normalizeSlug, validateSlug } from './publicLink.service';

function optionalUserId(req: Request) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId?: string };
    return decoded.userId || null;
  } catch {
    return null;
  }
}

function publicDto(target: any, type: 'group' | 'channel', userId: string | null) {
  const members = target.members || [];
  return {
    id: target.id,
    title: target.name,
    slug: target.slug,
    description: target.description,
    avatarUrl: target.avatarImage,
    avatarColor: target.avatarColor,
    membersCount: members.length,
    isMember: Boolean(userId && members.some((member: any) => member.userId === userId)),
    type,
  };
}

async function canManage(targetType: 'group' | 'channel', targetId: string, userId: string) {
  if (targetType === 'group') {
    const group = await db.group.findUnique({ where: { id: targetId }, include: { members: true } });
    const member = group?.members.find((item) => item.userId === userId);
    return Boolean(group && (group.creatorId === userId || member?.role === 'owner' || member?.role === 'admin' || member?.isCoOwner));
  }
  const channel = await db.channel.findUnique({ where: { id: targetId }, include: { members: true } });
  const member = channel?.members.find((item) => item.userId === userId);
  return Boolean(channel && (channel.ownerId === userId || member?.role === 'owner' || member?.role === 'admin'));
}

export function registerPublicLinkRoutes(app: Express) {
  const linkLimiter = rateLimit({ windowMs: 60_000, max: 90, standardHeaders: true, legacyHeaders: false });

  app.get('/api/public-link/check', linkLimiter, async (req, res) => {
    const slug = normalizeSlug(req.query.slug);
    const error = validateSlug(slug);
    res.json({ available: !error && await isSlugAvailable(slug), error });
  });

  app.get('/api/channels/public/:slug', linkLimiter, async (req, res) => {
    const channel = await db.channel.findFirst({ where: { slug: normalizeSlug(req.params.slug), isPublic: true }, include: { members: true } });
    if (!channel) return res.status(404).json({ error: 'Ссылка недействительна или больше не существует' });
    res.json(publicDto(channel, 'channel', optionalUserId(req)));
  });

  app.get('/api/groups/public/:slug', linkLimiter, async (req, res) => {
    const group = await db.group.findFirst({ where: { slug: normalizeSlug(req.params.slug), isPublic: true }, include: { members: true } });
    if (!group) return res.status(404).json({ error: 'Ссылка недействительна или больше не существует' });
    res.json(publicDto(group, 'group', optionalUserId(req)));
  });

  app.post('/api/channels/:id/subscribe', authenticateUser, async (req: any, res) => {
    const channel = await db.channel.findUnique({ where: { id: req.params.id } });
    if (!channel?.isPublic) return res.status(404).json({ error: 'Канал недоступен' });
    await db.channelMember.upsert({ where: { userId_channelId: { userId: req.userId, channelId: channel.id } }, update: {}, create: { userId: req.userId, channelId: channel.id } });
    res.json({ ok: true });
  });

  app.post('/api/channels/:id/unsubscribe', authenticateUser, async (req: any, res) => {
    const channel = await db.channel.findUnique({ where: { id: req.params.id } });
    if (!channel || channel.ownerId === req.userId) return res.status(400).json({ error: 'Владелец не может отписаться' });
    await db.channelMember.deleteMany({ where: { userId: req.userId, channelId: channel.id } });
    res.json({ ok: true });
  });

  app.post('/api/groups/:id/join', authenticateUser, async (req: any, res) => {
    const group = await db.group.findUnique({ where: { id: req.params.id } });
    if (!group?.isPublic) return res.status(404).json({ error: 'Группа недоступна' });
    await db.groupMember.upsert({ where: { userId_groupId: { userId: req.userId, groupId: group.id } }, update: {}, create: { userId: req.userId, groupId: group.id } });
    res.json({ ok: true });
  });

  app.post('/api/groups/:id/leave', authenticateUser, async (req: any, res) => {
    const group = await db.group.findUnique({ where: { id: req.params.id } });
    if (!group || group.creatorId === req.userId) return res.status(400).json({ error: 'Владелец не может покинуть группу' });
    await db.groupMember.deleteMany({ where: { userId: req.userId, groupId: group.id } });
    res.json({ ok: true });
  });

  app.post('/api/invites', authenticateUser, async (req: any, res) => {
    const targetType = req.body?.targetType === 'channel' ? 'channel' : req.body?.targetType === 'group' ? 'group' : null;
    const targetId = String(req.body?.targetId || '');
    if (!targetType || !targetId || !(await canManage(targetType, targetId, req.userId))) return res.status(403).json({ error: 'Недостаточно прав' });
    const maxUses = Number.isInteger(req.body?.maxUses) && req.body.maxUses > 0 ? Math.min(req.body.maxUses, 100000) : null;
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    const invite = await db.inviteLink.create({ data: { targetType, targetId, createdBy: req.userId, inviteCode: newInviteCode(), maxUses, expiresAt } });
    res.json(invite);
  });

  app.get('/api/invites/:inviteCode', linkLimiter, async (req, res) => {
    const invite = await db.inviteLink.findUnique({ where: { inviteCode: req.params.inviteCode } });
    if (!invite || !inviteIsUsable(invite)) return res.status(404).json({ error: 'Ссылка недействительна или больше не существует' });
    const target = invite.targetType === 'channel'
      ? await db.channel.findUnique({ where: { id: invite.targetId }, include: { members: true } })
      : await db.group.findUnique({ where: { id: invite.targetId }, include: { members: true } });
    if (!target) return res.status(404).json({ error: 'Ссылка недействительна или больше не существует' });
    res.json({ ...publicDto(target, invite.targetType as 'group' | 'channel', optionalUserId(req)), inviteCode: invite.inviteCode });
  });

  app.post('/api/invites/:inviteCode/accept', authenticateUser, async (req: any, res) => {
    const invite = await db.inviteLink.findUnique({ where: { inviteCode: req.params.inviteCode } });
    if (!invite || !inviteIsUsable(invite)) return res.status(404).json({ error: 'Ссылка недействительна или больше не существует' });
    await db.$transaction(async (tx) => {
      if (invite.targetType === 'channel') await tx.channelMember.upsert({ where: { userId_channelId: { userId: req.userId, channelId: invite.targetId } }, update: {}, create: { userId: req.userId, channelId: invite.targetId } });
      else await tx.groupMember.upsert({ where: { userId_groupId: { userId: req.userId, groupId: invite.targetId } }, update: {}, create: { userId: req.userId, groupId: invite.targetId } });
      await tx.inviteLink.update({ where: { id: invite.id }, data: { usesCount: { increment: 1 } } });
    });
    res.json({ ok: true, type: invite.targetType, id: invite.targetId });
  });

  app.delete('/api/invites/:id', authenticateUser, async (req: any, res) => {
    const invite = await db.inviteLink.findUnique({ where: { id: req.params.id } });
    if (!invite || invite.createdBy !== req.userId) return res.status(404).json({ error: 'Ссылка не найдена' });
    await db.inviteLink.update({ where: { id: invite.id }, data: { isRevoked: true } });
    res.json({ ok: true });
  });

  const escapeHtml = (value: unknown) => String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const fallbackPage = (target: any, type: 'group' | 'channel', publicValue: string) => {
    const title = escapeHtml(target.name);
    const description = escapeHtml(target.description || (type === 'channel' ? 'Канал в NEXA' : 'Группа в NEXA'));
    const avatar = target.avatarImage ? escapeHtml(target.avatarImage) : '';
    const deepLink = type === 'channel' ? `nexa://channel/${publicValue}` : `nexa://group/${publicValue}`;
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} в NEXA</title><meta property="og:title" content="${title} в NEXA"><meta property="og:description" content="${description}">${avatar ? `<meta property="og:image" content="${avatar}">` : ''}<style>body{margin:0;background:#07111f;color:#fff;font:16px system-ui;display:grid;place-items:center;min-height:100vh}.c{text-align:center;max-width:420px;padding:36px}.a{width:96px;height:96px;border-radius:50%;object-fit:cover;background:#0e1a2b}.b{display:block;margin-top:22px;padding:14px 20px;border-radius:10px;background:#42ddf5;color:#07111f;text-decoration:none;font-weight:800}</style></head><body><main class="c">${avatar ? `<img class="a" src="${avatar}" alt="">` : ''}<h1>${title}</h1><p>${description}</p><a class="b" href="${deepLink}">Открыть в NEXA</a></main></body></html>`;
  };

  app.get('/c/:slug', linkLimiter, async (req, res, next) => {
    try {
      const channel = await db.channel.findFirst({ where: { slug: normalizeSlug(req.params.slug), isPublic: true } });
      if (!channel) return next();
      res.type('html').send(fallbackPage(channel, 'channel', channel.slug!));
    } catch (error) { next(error); }
  });
  app.get('/g/:slug', linkLimiter, async (req, res, next) => {
    try {
      const group = await db.group.findFirst({ where: { slug: normalizeSlug(req.params.slug), isPublic: true } });
      if (!group) return next();
      res.type('html').send(fallbackPage(group, 'group', group.slug!));
    } catch (error) { next(error); }
  });
  app.get('/join/:inviteCode', linkLimiter, async (req, res, next) => {
    try {
      const invite = await db.inviteLink.findUnique({ where: { inviteCode: req.params.inviteCode } });
      if (!invite || !inviteIsUsable(invite)) return next();
      const target = invite.targetType === 'channel'
        ? await db.channel.findUnique({ where: { id: invite.targetId } })
        : await db.group.findUnique({ where: { id: invite.targetId } });
      if (!target) return next();
      const page = fallbackPage(target, invite.targetType as 'group' | 'channel', invite.inviteCode)
        .replace(`nexa://${invite.targetType}/${invite.inviteCode}`, `nexa://join/${invite.inviteCode}`);
      res.type('html').send(page);
    } catch (error) { next(error); }
  });
}
