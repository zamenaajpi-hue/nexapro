import { db } from '../../services/db';

export const channelRepository = {
  findById: async (id: string, includeMembers = false) => 
    db.channel.findUnique({ 
      where: { id },
      include: includeMembers ? { members: { include: { user: true } } } : undefined
    }),

  count: async () => db.channel.count(),

  findMany: async (args: any = {}) => db.channel.findMany(args),

  findForUser: async (userId: string) => 
    db.channel.findMany({
      where: { members: { some: { userId } } },
      include: { members: { include: { user: true } } }
    }),

  create: async (data: any, includeMembers = false) => 
    db.channel.create({ 
      data,
      include: includeMembers ? { members: { include: { user: true } } } : undefined
    }),

  update: async (id: string, data: any, includeMembers = false) =>
    db.channel.update({
      where: { id },
      data,
      include: includeMembers ? { members: { include: { user: true } } } : undefined
    }),

  addMember: async (channelId: string, userId: string) =>
    db.channelMember.upsert({
      where: { userId_channelId: { userId, channelId } },
      update: {},
      create: { userId, channelId, role: 'subscriber' },
    }),

  setMemberRole: async (channelId: string, userId: string, role: 'admin' | 'subscriber') =>
    db.channelMember.update({
      where: { userId_channelId: { userId, channelId } },
      data: { role },
    }),

  deleteWithRelations: async (id: string) => {
    return db.$transaction([
      db.channelMember.deleteMany({ where: { channelId: id } }),
      db.channelPost.deleteMany({ where: { channelId: id } }),
      db.channel.delete({ where: { id } })
    ]);
  }
};
