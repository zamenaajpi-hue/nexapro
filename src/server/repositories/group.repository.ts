import { db } from '../../services/db';

export const groupRepository = {
  findById: async (id: string, includeMembers = false) => 
    db.group.findUnique({ 
      where: { id },
      include: includeMembers ? { members: { include: { user: true } } } : undefined
    }),

  count: async () => db.group.count(),

  findMany: async (args: any = {}) => db.group.findMany(args),

  findForUser: async (userId: string) => 
    db.group.findMany({
      where: { members: { some: { userId } } },
      include: { members: { include: { user: true } } }
    }),

  create: async (data: any, includeMembers = false) => 
    db.group.create({ 
      data,
      include: includeMembers ? { members: { include: { user: true } } } : undefined
    }),

  update: async (id: string, data: any, includeMembers = false) =>
    db.group.update({
      where: { id },
      data,
      include: includeMembers ? { members: { include: { user: true } } } : undefined
    }),

  addMember: async (groupId: string, userId: string) =>
    db.groupMember.upsert({
      where: { userId_groupId: { userId, groupId } },
      update: {},
      create: { userId, groupId, role: 'member' },
    }),

  deleteWithRelations: async (id: string) => {
    const messages = await db.message.findMany({
      where: { toGroupId: id },
      select: { id: true },
    });
    const messageIds = messages.map((message) => message.id);

    return db.$transaction([
      messageIds.length
        ? db.reaction.deleteMany({ where: { messageId: { in: messageIds } } })
        : db.reaction.deleteMany({ where: { id: '__never__' } }),
      messageIds.length
        ? db.message.updateMany({ where: { replyToId: { in: messageIds } }, data: { replyToId: null } })
        : db.message.updateMany({ where: { id: '__never__' }, data: { replyToId: null } }),
      db.groupMember.deleteMany({ where: { groupId: id } }),
      db.message.deleteMany({ where: { toGroupId: id } }),
      db.group.delete({ where: { id } })
    ]);
  }
};
