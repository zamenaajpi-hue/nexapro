import { db } from '../../services/db';
import { safeUser } from '../utils/safeUser';

export const safeMessage = (message: any) => {
  if (!message) return message;
  return {
    ...message,
    from: message.from ? safeUser(message.from) : message.from,
    replyTo: message.replyTo
      ? {
          ...message.replyTo,
          from: message.replyTo.from ? safeUser(message.replyTo.from) : message.replyTo.from,
        }
      : message.replyTo,
    reactions: Array.isArray(message.reactions)
      ? message.reactions.map((reaction: any) => ({
          ...reaction,
          user: reaction.user ? safeUser(reaction.user) : reaction.user,
        }))
      : message.reactions,
  };
};

export const safeMessages = (messages: any[]) => messages.map(safeMessage);

export const messageRepository = {
  count: async () => db.message.count(),

  findMany: async (args: any = {}) => db.message.findMany(args),

  delete: async (id: string) => db.message.delete({ where: { id } }),

  create: async (data: any, includeRelations = false) => 
    db.message.create({ 
      data,
      include: includeRelations ? { from: true, replyTo: { include: { from: true } }, reactions: true } : undefined
    }).then(safeMessage),

  getHistoryForGroup: async (groupId: string, limit = 50) => 
    db.message.findMany({
      where: { toGroupId: groupId },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { from: true, replyTo: { include: { from: true } }, reactions: true }
    }).then(safeMessages),

  getHistoryForDirectMessage: async (userId1: string, userId2: string, limit = 50) =>
    db.message.findMany({
      where: {
        OR: [
          { fromId: userId1, toUserId: userId2 },
          { fromId: userId2, toUserId: userId1 }
        ]
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { from: true, replyTo: { include: { from: true } }, reactions: true }
    }).then(safeMessages),

  pinMessage: async (id: string, isPinned: boolean) => 
    db.message.update({
      where: { id },
      data: { isPinned },
      include: { from: true, replyTo: { include: { from: true } }, reactions: true }
    }).then(safeMessage),

  toggleReaction: async (messageId: string, userId: string, emoji: string) => {
    const existing = await db.reaction.findUnique({
      where: { userId_messageId_emoji: { userId, messageId, emoji } }
    });

    if (existing) {
      await db.reaction.delete({
        where: { userId_messageId_emoji: { userId, messageId, emoji } }
      });
    } else {
      const userReactions = await db.reaction.findMany({
        where: { userId, messageId }
      });

      if (userReactions.length >= 2) {
        // Remove the oldest reaction (the first one) so that maximum 2 reactions are allowed
        const oldReaction = userReactions[0];
        await db.reaction.delete({
          where: { id: oldReaction.id }
        });
      }

      await db.reaction.create({
        data: { userId, messageId, emoji }
      });
    }

    return db.message.findUnique({
      where: { id: messageId },
      include: { from: true, replyTo: { include: { from: true } }, reactions: true }
    }).then(safeMessage);
  },

  searchMessages: async (currentUserId: string, chatId: string, query: string, isGroup: boolean) => {
    return db.message.findMany({
      where: {
        text: { contains: query },
        ...(isGroup ? { toGroupId: chatId } : {
          OR: [
            { fromId: currentUserId, toUserId: chatId },
            { fromId: chatId, toUserId: currentUserId }
          ]
        })
      },
      orderBy: { timestamp: 'desc' },
      take: 50,
      include: { from: true, replyTo: { include: { from: true } }, reactions: true }
    }).then(safeMessages);
  },

  markAsRead: async (chatId: string, currentUserId: string) => {
    return db.message.updateMany({
      where: {
        fromId: chatId,
        toUserId: currentUserId,
        status: { not: 'read' }
      },
      data: {
        status: 'read'
      }
    });
  },

  markDeliveredToUser: async (userId: string) => {
    const pendingMessages = await db.message.findMany({
      where: {
        toUserId: userId,
        status: 'sent',
      },
      select: { id: true, fromId: true },
    });

    if (pendingMessages.length === 0) {
      return { count: 0, senderIds: [] as string[] };
    }

    await db.message.updateMany({
      where: {
        id: { in: pendingMessages.map((message) => message.id) },
      },
      data: { status: 'delivered' },
    });

    return {
      count: pendingMessages.length,
      senderIds: Array.from(new Set(pendingMessages.map((message) => message.fromId))),
    };
  }
};
