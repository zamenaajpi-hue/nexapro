import { db } from '../../services/db';

export const userRepository = {
  findByEmailOrNickname: async (email: string, nickname: string) => {
    const [userByEmail, userByNickname] = await Promise.all([
      userRepository.findByEmail(email),
      userRepository.findByNickname(nickname),
    ]);

    return userByEmail || userByNickname;
  },

  findByEmail: async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const matches = await db.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "User"
      WHERE "email" IS NOT NULL
        AND lower("email") = ${normalizedEmail}
      LIMIT 1
    `;

    if (!matches[0]?.id) return null;

    return db.user.findUnique({ where: { id: matches[0].id } });
  },

  findByNickname: async (nickname: string) =>
    db.user.findUnique({ where: { nickname } }),

  findByGoogleSub: async (googleSub: string) =>
    db.user.findUnique({ where: { googleSub } }),

  findByNormalizedPhone: async (normalizedPhone: string) =>
    db.user.findUnique({ where: { normalizedPhone } }),

  findById: async (id: string) => 
    db.user.findUnique({ where: { id } }),

  count: async () => db.user.count(),

  create: async (data: any) => db.user.create({ data }),

  update: async (id: string, data: any) => 
    db.user.update({ where: { id }, data }),

  findMany: async (args: any = {}) => db.user.findMany(args),

  deleteWithRelations: async (id: string) => {
    const [ownedGroups, ownedChannels, authoredPosts, userMessages] = await Promise.all([
      db.group.findMany({ where: { creatorId: id }, select: { id: true } }),
      db.channel.findMany({ where: { ownerId: id }, select: { id: true } }),
      db.channelPost.findMany({ where: { authorId: id }, select: { id: true } }),
      db.message.findMany({
        where: { OR: [{ fromId: id }, { toUserId: id }] },
        select: { id: true }
      })
    ]);

    const ownedGroupIds = ownedGroups.map(g => g.id);
    const ownedChannelIds = ownedChannels.map(c => c.id);
    const authoredPostIds = authoredPosts.map(p => p.id);
    const userMessageIds = userMessages.map(m => m.id);
    const ownedGroupMessages = ownedGroupIds.length
      ? await db.message.findMany({
          where: { toGroupId: { in: ownedGroupIds } },
          select: { id: true }
        })
      : [];
    const deletedMessageIds = Array.from(new Set([
      ...userMessageIds,
      ...ownedGroupMessages.map(m => m.id),
    ]));

    return db.$transaction([
      db.reaction.deleteMany({
        where: {
          OR: [
            { userId: id },
            deletedMessageIds.length ? { messageId: { in: deletedMessageIds } } : { id: '__never__' }
          ]
        }
      }),
      db.channelReaction.deleteMany({
        where: {
          OR: [
            { userId: id },
            authoredPostIds.length ? { postId: { in: authoredPostIds } } : { id: '__never__' }
          ]
        }
      }),
      db.storyView.deleteMany({ where: { userId: id } }),
      db.storyReaction.deleteMany({ where: { userId: id } }),
      db.chatState.deleteMany({ where: { userId: id } }),
      db.messageReceipt.deleteMany({ where: { userId: id } }),
      db.savedMessage.deleteMany({ where: { userId: id } }),
      db.closeFriend.deleteMany({ where: { OR: [{ ownerId: id }, { friendId: id }] } }),
      db.uploadedFile.deleteMany({ where: { userId: id } }),
      db.pushToken.deleteMany({ where: { userId: id } }),
      deletedMessageIds.length
        ? db.message.updateMany({ where: { replyToId: { in: deletedMessageIds } }, data: { replyToId: null } })
        : db.message.updateMany({ where: { id: '__never__' }, data: { replyToId: null } }),
      db.message.deleteMany({
        where: {
          OR: [
            { fromId: id },
            { toUserId: id },
            ownedGroupIds.length ? { toGroupId: { in: ownedGroupIds } } : { id: '__never__' }
          ]
        }
      }),
      db.channelPost.deleteMany({ where: { authorId: id } }),
      db.channelMember.deleteMany({ where: { userId: id } }),
      db.groupMember.deleteMany({ where: { userId: id } }),
      ownedChannelIds.length
        ? db.channel.deleteMany({ where: { id: { in: ownedChannelIds } } })
        : db.channel.deleteMany({ where: { id: '__never__' } }),
      ownedGroupIds.length
        ? db.group.deleteMany({ where: { id: { in: ownedGroupIds } } })
        : db.group.deleteMany({ where: { id: '__never__' } }),
      db.story.deleteMany({ where: { userId: id } }),
      db.user.delete({ where: { id } })
    ]);
  }
};
