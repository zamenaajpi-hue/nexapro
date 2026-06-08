import { db } from '../../services/db';

export const userRepository = {
  findByEmailOrNickname: async (email: string, nickname: string) => 
    db.user.findFirst({ where: { OR: [{ email }, { nickname }] } }),

  findByEmail: async (email: string) => 
    db.user.findUnique({ where: { email } }),

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

    return db.$transaction([
      db.reaction.deleteMany({
        where: {
          OR: [
            { userId: id },
            userMessageIds.length ? { messageId: { in: userMessageIds } } : { id: '__never__' }
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
      db.message.updateMany({ where: { replyToId: { in: userMessageIds } }, data: { replyToId: null } }),
      db.message.deleteMany({ where: { OR: [{ fromId: id }, { toUserId: id }] } }),
      db.channelPost.deleteMany({ where: { authorId: id } }),
      db.channelMember.deleteMany({ where: { userId: id } }),
      db.groupMember.deleteMany({ where: { userId: id } }),
      ownedChannelIds.length
        ? db.channel.deleteMany({ where: { id: { in: ownedChannelIds } } })
        : db.channel.deleteMany({ where: { id: '__never__' } }),
      ownedGroupIds.length
        ? db.message.deleteMany({ where: { toGroupId: { in: ownedGroupIds } } })
        : db.message.deleteMany({ where: { id: '__never__' } }),
      ownedGroupIds.length
        ? db.group.deleteMany({ where: { id: { in: ownedGroupIds } } })
        : db.group.deleteMany({ where: { id: '__never__' } }),
      db.story.deleteMany({ where: { userId: id } }),
      db.user.delete({ where: { id } })
    ]);
  }
};
