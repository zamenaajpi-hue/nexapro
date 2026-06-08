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

  deleteWithRelations: async (id: string) => {
    return db.$transaction([
      db.groupMember.deleteMany({ where: { groupId: id } }),
      db.message.deleteMany({ where: { toGroupId: id } }),
      db.group.delete({ where: { id } })
    ]);
  }
};
