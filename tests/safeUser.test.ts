import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { privateUserDto, profileViewUserDto, publicUserDto, safeUser, safeUsers } from '../src/server/utils/safeUser';
import { assertNoLeakedUserFields } from './testHelpers';

describe('safeUser', () => {
  it('publicUserDto returns the exact public profile shape', () => {
    const result = publicUserDto({
      id: 'u1',
      nickname: 'sam',
      nexaId: 'nexa-123456',
      avatarColor: '#111111',
      avatarImage: '/avatar.png',
      initials: 'SA',
      bio: 'hello',
      publicKey: 'public-key',
      status: 'online',
      email: 'user@example.com',
      socketId: 'socket-1',
      pushTokens: [{ token: 'secret' }],
    });

    assert.deepEqual(Object.keys(result), [
      'id',
      'nickname',
      'nexaId',
      'avatarColor',
      'avatarImage',
      'initials',
      'bio',
      'publicKey',
      'status',
    ]);
    assert.deepEqual(result, {
      id: 'u1',
      nickname: 'sam',
      nexaId: 'nexa-123456',
      avatarColor: '#111111',
      avatarImage: '/avatar.png',
      initials: 'SA',
      bio: 'hello',
      publicKey: 'public-key',
      status: 'online',
    });
  });

  it('returns only public profile fields', () => {
    const result = safeUser({
      id: 'u1',
      email: 'user@example.com',
      nickname: 'sam',
      passwordHash: 'secret-hash',
      role: 'user',
      balance: 42,
      socketId: 'socket-1',
      pushTokens: [{ token: 'secret' }],
      fcmToken: 'fcm-secret',
      apnsToken: 'apns-secret',
      expoPushToken: 'expo-secret',
      resetToken: 'reset-secret',
    });

    assert.equal(result.id, 'u1');
    assert.equal(result.nickname, 'sam');
    assertNoLeakedUserFields(result);
  });

  it('sanitizes arrays', () => {
    const result = safeUsers([
      { id: 'u1', nickname: 'one', passwordHash: 'hash-1' },
      { id: 'u2', nickname: 'two', passwordHash: 'hash-2' },
    ]);

    assert.equal(result.length, 2);
    assert.equal(Object.prototype.hasOwnProperty.call(result[0], 'passwordHash'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result[1], 'passwordHash'), false);
  });

  it('keeps private fields only for the current user dto', () => {
    const result = privateUserDto({
      id: 'u1',
      email: 'user@example.com',
      phoneNumber: '+10000000000',
      nickname: 'sam',
      passwordHash: 'secret-hash',
      role: 'user',
      balance: 42,
    });

    assert.equal(result.email, 'user@example.com');
    assert.equal(result.phoneNumber, '+10000000000');
    assert.equal(result.role, 'user');
    assert.equal(result.balance, 42);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'passwordHash'), false);
  });

  it('keeps profile contact fields private by default', () => {
    const result = profileViewUserDto({
      id: 'owner',
      nickname: 'sam',
      email: 'user@example.com',
      phoneNumber: '+10000000000',
      emailVisibility: 'PRIVATE',
      phoneVisibility: 'PRIVATE',
    }, { viewerId: 'viewer' });

    assert.equal(Object.prototype.hasOwnProperty.call(result, 'email'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'phoneNumber'), false);
  });

  it('allows profile contact fields for owner, admin, public, and contacts visibility', () => {
    const user = {
      id: 'owner',
      nickname: 'sam',
      email: 'user@example.com',
      phoneNumber: '+10000000000',
      emailVisibility: 'PUBLIC',
      phoneVisibility: 'CONTACTS',
    };

    assert.equal(profileViewUserDto(user, { viewerId: 'viewer' }).email, 'user@example.com');
    assert.equal(Object.prototype.hasOwnProperty.call(profileViewUserDto(user, { viewerId: 'viewer' }), 'phoneNumber'), false);
    assert.equal(profileViewUserDto(user, { viewerId: 'viewer', isContact: true }).phoneNumber, '+10000000000');
    assert.equal(profileViewUserDto({ ...user, emailVisibility: 'PRIVATE', phoneVisibility: 'PRIVATE' }, { viewerId: 'owner' }).email, 'user@example.com');
    assert.equal(profileViewUserDto({ ...user, emailVisibility: 'PRIVATE', phoneVisibility: 'PRIVATE' }, { viewerId: 'viewer', isAdmin: true }).phoneNumber, '+10000000000');
  });
});
