import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeMessage } from '../src/server/repositories/message.repository';
import { safeStory } from '../src/server/stories/story.repository';
import { safeGroupPayload } from '../src/server/socket/group.handler';
import { safeChannelPayload, safeChannelPostPayload } from '../src/server/socket/channel.handler';
import { safeCallUserPayload } from '../src/server/socket/call.handler';
import { publicUsersDto } from '../src/server/utils/safeUser';
import { assertNoLeakedUserFields } from './testHelpers';

const unsafeUser = {
  id: 'u1',
  nickname: 'sam',
  nexaId: 'nexa-111111',
  avatarColor: '#123456',
  avatarImage: '/a.png',
  initials: 'SA',
  bio: 'bio',
  publicKey: 'pub',
  status: 'online',
  socketId: 'socket-secret',
  email: 'user@example.com',
  phoneNumber: '+10000000000',
  dateOfBirth: '2000-01-01',
  role: 'admin',
  balance: 999,
  passwordHash: 'hash',
  resetToken: 'reset',
  pushTokens: [{ token: 'push-secret' }],
};

describe('socket public payload hardening', () => {
  it('sanitizes online users payloads', () => {
    const [user] = publicUsersDto([unsafeUser]);
    assert.equal(user.id, 'u1');
    assertNoLeakedUserFields(user);
  });

  it('sanitizes message sender and reply author payloads', () => {
    const message = safeMessage({
      id: 'm1',
      from: unsafeUser,
      replyTo: { id: 'm0', from: { ...unsafeUser, id: 'u2' } },
      reactions: [{ id: 'r1', user: { ...unsafeUser, id: 'u3' } }],
    });

    assertNoLeakedUserFields(message.from);
    assertNoLeakedUserFields(message.replyTo.from);
    assertNoLeakedUserFields(message.reactions[0].user);
  });

  it('sanitizes story owner, viewers, and reaction users', () => {
    const story = safeStory({
      id: 's1',
      user: unsafeUser,
      views: [{ id: 'v1', user: { ...unsafeUser, id: 'viewer' } }],
      reactions: [{ id: 'sr1', user: { ...unsafeUser, id: 'reactor' } }],
    });

    assertNoLeakedUserFields(story.user);
    assertNoLeakedUserFields(story.views[0].user);
    assertNoLeakedUserFields(story.reactions[0].user);
  });

  it('sanitizes group members payloads', () => {
    const group = safeGroupPayload({
      id: 'g1',
      creator: unsafeUser,
      members: [{ id: 'gm1', role: 'member', user: { ...unsafeUser, id: 'member' } }],
    });

    assertNoLeakedUserFields(group.creator);
    assertNoLeakedUserFields(group.members[0].user);
    assert.equal(group.members[0].role, 'member');
  });

  it('sanitizes channel owner, subscribers, and post author payloads', () => {
    const channel = safeChannelPayload({
      id: 'c1',
      owner: unsafeUser,
      members: [{ id: 'cm1', role: 'subscriber', user: { ...unsafeUser, id: 'subscriber' } }],
    });
    const post = safeChannelPostPayload({ id: 'p1', author: { ...unsafeUser, id: 'author' } });

    assertNoLeakedUserFields(channel.owner);
    assertNoLeakedUserFields(channel.members[0].user);
    assertNoLeakedUserFields(post.author);
    assert.equal(channel.members[0].role, 'subscriber');
  });

  it('sanitizes call incoming user payloads', () => {
    const caller = safeCallUserPayload(unsafeUser);

    assert.equal(caller.id, 'u1');
    assertNoLeakedUserFields(caller);
  });
});
