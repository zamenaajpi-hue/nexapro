import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/user.repository';
import { db } from '../../services/db';
import { getJwtSecret } from '../config/auth';
import { privateUserDto } from '../utils/safeUser';

const getInitials = (name: string) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?';
const normalizePhone = (phone?: string | null) => {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && (digits.startsWith('8') || digits.startsWith('7'))) return `7${digits.slice(1)}`;
  return digits;
};

export const authService = {
  register: async (data: any) => {
    const existing = await userRepository.findByEmailOrNickname(data.email, data.nickname);
    if (existing?.email === data.email) throw new Error('Пользователь с такой почтой уже существует');
    if (existing?.nickname === data.nickname) throw new Error('Этот никнейм уже занят');

    const normalizedPhone = normalizePhone(data.phoneNumber);
    if (normalizedPhone) {
      const existingPhone = await userRepository.findByNormalizedPhone(normalizedPhone);
      if (existingPhone) throw new Error('Этот номер телефона уже привязан к другому аккаунту');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const role = 'user';

    let nexaId = '';
    let isUnique = false;
    while (!isUnique) {
      const randomNum = Math.floor(100000 + Math.random() * 900000);
      nexaId = `nexa-${randomNum}`;
      const existingWithId = await db.user.findFirst({ where: { nexaId } });
      if (!existingWithId) {
        isUnique = true;
      }
    }

    const user = await userRepository.create({
      email: data.email,
      phoneNumber: data.phoneNumber || null,
      normalizedPhone,
      nickname: data.nickname,
      nexaId,
      passwordHash,
      avatarColor: data.avatarColor || '#6C63FF',
      initials: getInitials(data.nickname),
      publicKey: data.publicKey,
      role
    });

    // Auto-join test group if it exists
    await db.groupMember.create({
      data: {
        userId: user.id,
        groupId: 'test-group-id'
      }
    }).catch(() => {});

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
    return { user: privateUserDto(user), token };
  },

  login: async (data: any) => {
    const user = await userRepository.findByEmail(data.email);
    if (!user || !user.passwordHash) throw new Error('Invalid credentials');

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error('Invalid credentials');

    const token = jwt.sign({ userId: user.id }, getJwtSecret(), { expiresIn: '7d' });
    return { user: privateUserDto(user), token };
  }
};
