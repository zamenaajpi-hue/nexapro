import { db } from '../../services/db';

export type ChatType = 'direct' | 'group' | 'channel';

type UpsertChatStateInput = {
  userId: string;
  chatId: string;
  chatType: ChatType;
  unreadDelta?: number;
  unread?: number;
  pinned?: boolean;
  archived?: boolean;
  mutedUntil?: Date | null;
  lastReadAt?: Date | null;
};

export const chatStateRepository = {
  findForUser: async (userId: string) =>
    db.chatState.findMany({
      where: { userId },
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    }),

  upsert: async ({
    userId,
    chatId,
    chatType,
    unreadDelta,
    unread,
    pinned,
    archived,
    mutedUntil,
    lastReadAt,
  }: UpsertChatStateInput) => {
    const createData = {
      userId,
      chatId,
      chatType,
      unread: unread ?? Math.max(0, unreadDelta ?? 0),
      pinned: pinned ?? false,
      archived: archived ?? false,
      mutedUntil,
      lastReadAt,
    };

    const updateData: any = {};
    if (typeof unread === 'number') updateData.unread = Math.max(0, unread);
    if (typeof unreadDelta === 'number') updateData.unread = { increment: unreadDelta };
    if (typeof pinned === 'boolean') updateData.pinned = pinned;
    if (typeof archived === 'boolean') updateData.archived = archived;
    if (mutedUntil !== undefined) updateData.mutedUntil = mutedUntil;
    if (lastReadAt !== undefined) updateData.lastReadAt = lastReadAt;

    return db.chatState.upsert({
      where: { userId_chatId_chatType: { userId, chatId, chatType } },
      create: createData,
      update: updateData,
    });
  },

  touch: async (userId: string, chatId: string, chatType: ChatType) =>
    chatStateRepository.upsert({ userId, chatId, chatType, unreadDelta: 0 }),

  remove: async (userId: string, chatId: string, chatType: ChatType) =>
    db.chatState.deleteMany({ where: { userId, chatId, chatType } }),

  incrementUnread: async (userId: string, chatId: string, chatType: ChatType) =>
    chatStateRepository.upsert({ userId, chatId, chatType, unreadDelta: 1, archived: false }),

  markRead: async (userId: string, chatId: string, chatType: ChatType) =>
    chatStateRepository.upsert({
      userId,
      chatId,
      chatType,
      unread: 0,
      lastReadAt: new Date(),
    }),

  updatePreferences: async (
    userId: string,
    chatId: string,
    chatType: ChatType,
    data: Pick<UpsertChatStateInput, 'pinned' | 'archived' | 'mutedUntil'>,
  ) => chatStateRepository.upsert({ userId, chatId, chatType, ...data }),
};
