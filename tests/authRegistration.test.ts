import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/services/db';
import { authService } from '../src/server/services/auth.service';

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

describe('auth registration', () => {
  it('rejects duplicate phone numbers with a user-facing error', async () => {
    const existingId = unique('phone-owner');
    const phoneNumber = '+79991112233';
    const normalizedPhone = '79991112233';

    await db.user.create({
      data: {
        id: existingId,
        email: `${existingId}@example.test`,
        nickname: existingId,
        phoneNumber,
        normalizedPhone,
        passwordHash: 'hash',
        avatarColor: '#67e8f9',
      },
    });

    try {
      await assert.rejects(
        authService.register({
          email: `${unique('new-phone-user')}@example.test`,
          nickname: unique('new-phone-user'),
          password: 'secret123',
          phoneNumber: '89991112233',
          avatarColor: '#6C63FF',
        }),
        /Этот номер телефона уже привязан к другому аккаунту/,
      );
    } finally {
      await db.user.deleteMany({ where: { id: existingId } });
    }
  });

  it('rejects phone numbers outside +7XXXXXXXXXX or 8XXXXXXXXXX', async () => {
    await assert.rejects(
      authService.register({
        email: `${unique('bad-phone-user')}@example.test`,
        nickname: unique('bad-phone-user'),
        password: 'secret123',
        phoneNumber: '+1 555 111 22 33',
        avatarColor: '#6C63FF',
      }),
      /Введите номер в формате \+7XXXXXXXXXX или 8XXXXXXXXXX/,
    );
  });
});
