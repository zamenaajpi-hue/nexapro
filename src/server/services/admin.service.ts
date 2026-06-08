import { userRepository } from '../repositories/user.repository';
import { groupRepository } from '../repositories/group.repository';
import { messageRepository } from '../repositories/message.repository';
import { adminUserDto, publicUserDto } from '../utils/safeUser';

const safeMember = (member: any) => ({ ...member, user: member.user ? publicUserDto(member.user) : member.user });
const safeGroup = (group: any) => ({
  ...group,
  creator: group.creator ? publicUserDto(group.creator) : group.creator,
  members: Array.isArray(group.members) ? group.members.map(safeMember) : group.members,
});
const safeMessage = (message: any) => ({
  ...message,
  from: message.from ? publicUserDto(message.from) : message.from,
});

export const adminService = {
  getStats: async () => {
    const totalUsers = await userRepository.count();
    const totalGroups = await groupRepository.count();
    const totalMessages = await messageRepository.count();
    return { totalUsers, totalGroups, totalMessages };
  },

  getUsers: async () => {
    const users = await userRepository.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map(adminUserDto);
  },

  updateUserRole: async (id: string, role: string) => {
    return userRepository.update(id, { role }).then(adminUserDto);
  },

  deleteUser: async (id: string) => {
    return userRepository.deleteWithRelations(id);
  },

  getGroups: async () => {
    const groups = await groupRepository.findMany({
      include: {
        creator: true,
        members: { include: { user: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return groups.map(safeGroup);
  },

  deleteGroup: async (id: string) => {
    return groupRepository.deleteWithRelations(id);
  },

  getMessages: async () => {
    const messages = await messageRepository.findMany({
      include: { from: true, toGroup: true },
      orderBy: { timestamp: 'desc' },
      take: 100
    });
    return messages.map(safeMessage);
  },

  deleteMessage: async (id: string) => {
    return messageRepository.delete(id);
  }
};
