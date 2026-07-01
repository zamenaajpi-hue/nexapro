import crypto from 'crypto';
import { db } from '../../services/db';

export const RESERVED_SLUGS = new Set([
  'admin', 'login', 'register', 'settings', 'api', 'join', 'channel', 'group', 'support', 'nexa',
]);

export function normalizeSlug(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

export function validateSlug(value: unknown): string | null {
  const slug = normalizeSlug(value);
  if (!/^[a-z0-9_]{4,32}$/.test(slug)) return 'Ссылка должна содержать 4-32 латинских символа, цифры или underscore';
  if (RESERVED_SLUGS.has(slug)) return 'Эта ссылка зарезервирована системой';
  return null;
}

export async function isSlugAvailable(slugValue: unknown, except?: { type: 'group' | 'channel'; id: string }) {
  const slug = normalizeSlug(slugValue);
  if (validateSlug(slug)) return false;
  const [group, channel] = await Promise.all([
    db.group.findUnique({ where: { slug }, select: { id: true } }),
    db.channel.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  return (!group || (except?.type === 'group' && group.id === except.id))
    && (!channel || (except?.type === 'channel' && channel.id === except.id));
}

export async function makeUniqueSlug(name: string) {
  const base = normalizeSlug(name)
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24);
  const safeBase = base.length >= 4 && !RESERVED_SLUGS.has(base) ? base : 'nexa';
  for (let index = 0; index < 12; index += 1) {
    const suffix = crypto.randomBytes(3).toString('hex');
    const candidate = `${safeBase}_${suffix}`.slice(0, 32);
    if (await isSlugAvailable(candidate)) return candidate;
  }
  return `nexa_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function newInviteCode() {
  return crypto.randomBytes(18).toString('base64url');
}

export function inviteIsUsable(invite: { isRevoked: boolean; expiresAt: Date | null; maxUses: number | null; usesCount: number }) {
  if (invite.isRevoked) return false;
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) return false;
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) return false;
  return true;
}
