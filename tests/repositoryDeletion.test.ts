import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/services/db';
import { groupRepository } from '../src/server/repositories/group.repository';
import { userRepository } from '../src/server/repositories/user.repository';

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

describe('repository deletion flows', () => {
  it('deletes a group with message replies and reactions', async () => {
    const owner = await createUser('group-owner');
    const member = await createUser('group-member');
    const groupId = unique('group');

    try {
      await db.group.create({
        data: {
          id: groupId,
          name: 'Regression group',
          avatarColor: '#67e8f9',
          creatorId: owner.id,
          members: {
            create: [
              { userId: owner.id, role: 'owner', isCoOwner: true },
              { userId: member.id, role: 'member' },
            ],
          },
        },
      });

      const rootMessage = await db.message.create({
        data: {
          text: 'root',
          fromId: owner.id,
          toGroupId: groupId,
        },
      });
      const replyMessage = await db.message.create({
        data: {
          text: 'reply',
          fromId: member.id,
          toGroupId: groupId,
          replyToId: rootMessage.id,
        },
      });
      await db.reaction.create({
        data: {
          userId: member.id,
          messageId: rootMessage.id,
          emoji: '👍',
        },
      });

      await groupRepository.deleteWithRelations(groupId);

      assert.equal(await db.group.findUnique({ where: { id: groupId } }), null);
      assert.equal(await db.message.findUnique({ where: { id: rootMessage.id } }), null);
      assert.equal(await db.message.findUnique({ where: { id: replyMessage.id } }), null);
      assert.equal(await db.reaction.count({ where: { messageId: rootMessage.id } }), 0);
    } finally {
      await db.reaction.deleteMany({ where: { userId: { in: [owner.id, member.id] } } });
      await db.message.deleteMany({ where: { OR: [{ fromId: owner.id }, { fromId: member.id }, { toGroupId: groupId }] } });
      await db.groupMember.deleteMany({ where: { OR: [{ userId: owner.id }, { userId: member.id }, { groupId }] } });
      await db.group.deleteMany({ where: { id: groupId } });
      await db.user.deleteMany({ where: { id: { in: [owner.id, member.id] } } });
    }
  });

  it('deletes an owner with owned group messages and reactions', async () => {
    const owner = await createUser('owner-delete');
    const member = await createUser('owner-delete-member');
    const groupId = unique('owned-group');

    try {
      await db.group.create({
        data: {
          id: groupId,
          name: 'Owned regression group',
          avatarColor: '#7c5cff',
          creatorId: owner.id,
          members: {
            create: [
              { userId: owner.id, role: 'owner', isCoOwner: true },
              { userId: member.id, role: 'member' },
            ],
          },
        },
      });

      const groupMessage = await db.message.create({
        data: {
          text: 'member message',
          fromId: member.id,
          toGroupId: groupId,
        },
      });
      await db.reaction.create({
        data: {
          userId: owner.id,
          messageId: groupMessage.id,
          emoji: '🔥',
        },
      });

      await userRepository.deleteWithRelations(owner.id);

      assert.equal(await db.user.findUnique({ where: { id: owner.id } }), null);
      assert.equal(await db.group.findUnique({ where: { id: groupId } }), null);
      assert.equal(await db.message.findUnique({ where: { id: groupMessage.id } }), null);
      assert.equal(await db.reaction.count({ where: { messageId: groupMessage.id } }), 0);
      assert.notEqual(await db.user.findUnique({ where: { id: member.id } }), null);
    } finally {
      await db.reaction.deleteMany({ where: { userId: { in: [owner.id, member.id] } } });
      await db.message.deleteMany({ where: { OR: [{ fromId: owner.id }, { fromId: member.id }, { toGroupId: groupId }] } });
      await db.groupMember.deleteMany({ where: { OR: [{ userId: owner.id }, { userId: member.id }, { groupId }] } });
      await db.group.deleteMany({ where: { id: groupId } });
      await db.user.deleteMany({ where: { id: { in: [owner.id, member.id] } } });
    }
  });
});
