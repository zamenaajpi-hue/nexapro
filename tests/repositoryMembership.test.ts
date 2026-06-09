import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/services/db';
import { groupRepository } from '../src/server/repositories/group.repository';
import { channelRepository } from '../src/server/repositories/channel.repository';

const unique = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const createUser = (prefix: string) => {
  const id = unique(prefix);
  return db.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      nickname: id,
      passwordHash: 'hash',
      avatarColor: '#67e8f9',
    },
  });
};

describe('repository membership flows', () => {
  it('adds group members idempotently', async () => {
    const owner = await createUser('group-member-owner');
    const member = await createUser('group-member-target');
    const groupId = unique('membership-group');

    try {
      await db.group.create({
        data: {
          id: groupId,
          name: 'Membership group',
          avatarColor: '#67e8f9',
          creatorId: owner.id,
          members: { create: [{ userId: owner.id, role: 'owner', isCoOwner: true }] },
        },
      });

      await groupRepository.addMember(groupId, member.id);
      await groupRepository.addMember(groupId, member.id);

      assert.equal(await db.groupMember.count({ where: { groupId, userId: member.id } }), 1);
    } finally {
      await db.groupMember.deleteMany({ where: { OR: [{ groupId }, { userId: { in: [owner.id, member.id] } }] } });
      await db.group.deleteMany({ where: { id: groupId } });
      await db.user.deleteMany({ where: { id: { in: [owner.id, member.id] } } });
    }
  });

  it('adds channel subscribers idempotently', async () => {
    const owner = await createUser('channel-member-owner');
    const subscriber = await createUser('channel-member-target');
    const channelId = unique('membership-channel');

    try {
      await db.channel.create({
        data: {
          id: channelId,
          name: 'Membership channel',
          avatarColor: '#7c5cff',
          ownerId: owner.id,
          members: { create: [{ userId: owner.id, role: 'owner' }] },
        },
      });

      await channelRepository.addMember(channelId, subscriber.id);
      await channelRepository.addMember(channelId, subscriber.id);

      assert.equal(await db.channelMember.count({ where: { channelId, userId: subscriber.id } }), 1);
    } finally {
      await db.channelMember.deleteMany({ where: { OR: [{ channelId }, { userId: { in: [owner.id, subscriber.id] } }] } });
      await db.channel.deleteMany({ where: { id: channelId } });
      await db.user.deleteMany({ where: { id: { in: [owner.id, subscriber.id] } } });
    }
  });
});
