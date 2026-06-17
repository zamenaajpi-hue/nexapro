import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { userRepository } from '../repositories/user.repository';
import { db } from '../../services/db';
import { getJwtSecret } from '../config/auth';
import { getGoogleClientId } from '../config/google';
import { privateUserDto } from '../utils/safeUser';
import { normalizeRussianPhone } from '../utils/phone';

const getInitials = (name: string) =>
  name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() || '';

const googleClient = new OAuth2Client();

const createUniqueNexaId = async () => {
  let nexaId = '';
  let isUnique = false;
  while (!isUnique) {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    nexaId = `nexa-${randomNum}`;
    const existingWithId = await db.user.findFirst({ where: { nexaId } });
    if (!existingWithId) isUnique = true;
  }
  return nexaId;
};

const createUniqueNickname = async (name?: string | null, email?: string | null) => {
  const emailName = email?.split('@')[0] || '';
  const base = (name || emailName || 'Google User').trim().slice(0, 32) || 'Google User';
  let nickname = base.length >= 2 ? base : `${base} user`;
  let suffix = 1;

  while (await db.user.findUnique({ where: { nickname } })) {
    const nextSuffix = ` ${suffix}`;
    nickname = `${base.slice(0, Math.max(2, 32 - nextSuffix.length))}${nextSuffix}`;
    suffix += 1;
  }

  return nickname;
};

const joinDefaultGroup = async (userId: string) => {
  await db.groupMember.create({
    data: {
      userId,
      groupId: 'test-group-id',
    },
  }).catch(() => {});
};

const createSession = (user: any) => {
  const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
  return { user: privateUserDto(user), token };
};

const verifyGoogleCredential = async (data: { credential?: string; accessToken?: string }) => {
  const clientId = getGoogleClientId();
  if (!clientId) throw new Error('Google sign-in is not configured');

  if (data.credential) {
    const ticket = await googleClient.verifyIdToken({
      idToken: data.credential,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.email_verified) throw new Error('Google account email is not verified');
    return payload;
  }

  const accessToken = data.accessToken;
  if (!accessToken) throw new Error('Google token is required');

  const tokenInfo = await googleClient.getTokenInfo(accessToken);
  if (tokenInfo.aud && tokenInfo.aud !== clientId) throw new Error('Google sign-in failed');

  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Google sign-in failed');

  const payload = await response.json() as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    picture?: string;
  };
  if (!payload?.email || !payload.email_verified) throw new Error('Google account email is not verified');

  return payload;
};

export const authService = {
  register: async (data: any) => {
    const email = normalizeEmail(data.email);
    const [existingEmailUser, existingNicknameUser] = await Promise.all([
      userRepository.findByEmail(email),
      userRepository.findByNickname(data.nickname),
    ]);

    if (existingEmailUser) {
      throw new Error(`Эта почта уже привязана к аккаунту @${existingEmailUser.nickname}`);
    }
    if (existingNicknameUser) throw new Error('Этот никнейм уже занят');

    const normalizedPhone = normalizeRussianPhone(data.phoneNumber);
    if (normalizedPhone) {
      const existingPhone = await userRepository.findByNormalizedPhone(normalizedPhone);
      if (existingPhone) throw new Error('Этот номер телефона уже привязан к другому аккаунту');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await userRepository.create({
      email,
      phoneNumber: data.phoneNumber || null,
      normalizedPhone,
      nickname: data.nickname,
      nexaId: await createUniqueNexaId(),
      passwordHash,
      avatarColor: data.avatarColor || '#6C63FF',
      initials: getInitials(data.nickname),
      publicKey: data.publicKey,
      role: 'user',
    });

    await joinDefaultGroup(user.id);

    return createSession(user);
  },

  login: async (data: any) => {
    const user = await userRepository.findByEmail(normalizeEmail(data.email));
    if (!user || !user.passwordHash) throw new Error('Invalid credentials');

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error('Invalid credentials');

    return createSession(user);
  },

  googleLogin: async (data: any) => {
    const payload = await verifyGoogleCredential(data);
    const email = normalizeEmail(payload.email);
    const googleSub = payload.sub;
    if (!googleSub) throw new Error('Google sign-in failed');

    const existingGoogleUser = await userRepository.findByGoogleSub(googleSub);
    if (existingGoogleUser) {
      return createSession(existingGoogleUser);
    }

    const existingEmailUser = await userRepository.findByEmail(email);
    if (existingEmailUser) {
      if (existingEmailUser.googleSub && existingEmailUser.googleSub !== googleSub) {
        throw new Error('This email is already linked to another Google account');
      }

      const linkedUser = existingEmailUser.googleSub
        ? existingEmailUser
        : await userRepository.update(existingEmailUser.id, { googleSub });
      return createSession(linkedUser);
    }

    const nickname = await createUniqueNickname(payload.name, email);
    const user = await userRepository.create({
      email,
      googleSub,
      phoneNumber: null,
      normalizedPhone: null,
      nickname,
      nexaId: await createUniqueNexaId(),
      passwordHash: null,
      avatarColor: data.avatarColor || '#6C63FF',
      avatarImage: payload.picture || null,
      initials: getInitials(nickname),
      publicKey: null,
      role: 'user',
    });

    await joinDefaultGroup(user.id);

    return createSession(user);
  },
};
