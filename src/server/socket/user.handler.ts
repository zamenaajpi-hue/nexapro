import { Server as SocketIOServer } from 'socket.io';
import { userRepository } from '../repositories/user.repository';
import { groupRepository } from '../repositories/group.repository';
import { z } from 'zod';
import { privateUserDto, publicUserDto, publicUsersDto } from '../utils/safeUser';
import { messageRepository } from '../repositories/message.repository';
import { INVALID_RUSSIAN_PHONE_MESSAGE, normalizeRussianPhone } from '../utils/phone';

const profileUpdateSchema = z.object({
  nickname: z.string().min(2).optional(),
  avatarColor: z.string().optional(),
  avatarImage: z.string().nullable().optional(),
  bio: z.string().optional(),
  phoneNumber: z.string().max(32).nullable().optional(),
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  dateOfBirth: z.string().nullable().optional(),
  activityStatus: z.string().nullable().optional(),
  publicKey: z.string().optional()
});

const duplicateProfileMessage = (err: any) => {
  if (err?.code !== 'P2002') return null;
  const target = Array.isArray(err?.meta?.target) ? err.meta.target : [];
  if (target.includes('normalizedPhone')) return 'Этот номер телефона уже привязан к другому аккаунту';
  if (target.includes('nickname')) return 'Этот никнейм уже занят';
  return 'Такие данные уже используются другим аккаунтом';
};

const safeMember = (member: any) => ({
  ...member,
  user: member.user ? publicUserDto(member.user) : member.user,
});

const safeGroup = (group: any) => ({
  ...group,
  creator: group.creator ? publicUserDto(group.creator) : group.creator,
  owner: group.owner ? publicUserDto(group.owner) : group.owner,
  members: Array.isArray(group.members) ? group.members.map(safeMember) : group.members,
});

export const handleUsers = (
  io: SocketIOServer, 
  socket: any, 
  onlineUsers: Map<string, any>,
  socketToUserMap: Map<string, string>
) => {
  const userId = socket.userId;

  socket.on('join', async () => {
    try {
      let user = await userRepository.findById(userId);
      if (!user) {
        socket.emit('auth:expired');
        return;
      }

      if (!user.nexaId) {
        const { db: prismaDb } = await import('../../services/db');
        let nexaId = '';
        let isUnique = false;
        while (!isUnique) {
          const randomNum = Math.floor(100000 + Math.random() * 900000);
          nexaId = `nexa-${randomNum}`;
          const existingWithId = await prismaDb.user.findFirst({ where: { nexaId } });
          if (!existingWithId) {
            isUnique = true;
          }
        }
        user = await userRepository.update(userId, { nexaId });
      }

      const userData = { ...publicUserDto({ ...user, status: 'online' }), socketId: socket.id };
      onlineUsers.set(userId, userData);
      socketToUserMap.set(socket.id, userId);

      const delivered = await messageRepository.markDeliveredToUser(userId);
      delivered.senderIds.forEach((senderId) => {
        const senderSocket = onlineUsers.get(senderId)?.socketId;
        if (senderSocket) {
          io.to(senderSocket).emit('messages:delivered', { chatId: userId });
        }
      });

      io.emit('users:online', publicUsersDto(Array.from(onlineUsers.values())));

      const userGroups = await groupRepository.findForUser(userId);
      const enrichedGroups = userGroups.map(g => ({ ...safeGroup(g), isGroup: true }));
      socket.emit('groups:update', enrichedGroups);

      const { db } = await import('../../services/db');
      const userChannels = await db.channel.findMany({
        where: { members: { some: { userId } } },
        include: { members: { include: { user: true } } }
      });
      const enrichedChannels = userChannels.map(c => ({ ...safeGroup(c), isChannel: true }));
      socket.emit('channels:update', enrichedChannels);

      const { chatStateRepository } = await import('../repositories/chat-state.repository');
      const directMessages = await db.message.findMany({
        where: {
          OR: [
            { fromId: userId, toUserId: { not: null } },
            { toUserId: userId },
          ],
        },
        select: { fromId: true, toUserId: true },
        distinct: ['fromId', 'toUserId'],
      });
      const directPeerIds = Array.from(new Set(
        directMessages
          .map((message) => message.fromId === userId ? message.toUserId : message.fromId)
          .filter((peerId): peerId is string => Boolean(peerId) && peerId !== userId)
      ));
      await Promise.all(directPeerIds.map((peerId) => chatStateRepository.touch(userId, peerId, 'direct')));
      socket.emit('chat:states', await chatStateRepository.findForUser(userId));
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('profile:update', async (payload: any) => {
    try {
      const data = profileUpdateSchema.parse(payload);
      
      const currentUser = await userRepository.findById(userId);
      if (!currentUser) return;

      const normalizedPhone = data.phoneNumber === undefined ? undefined : normalizeRussianPhone(data.phoneNumber);
      if (normalizedPhone) {
        const existingPhone = await userRepository.findByNormalizedPhone(normalizedPhone);
        if (existingPhone && existingPhone.id !== userId) {
          socket.emit('profile:update:error', { error: 'Этот номер телефона уже привязан к другому аккаунту' });
          return;
        }
      }

      const updateData: any = {
        nickname: data.nickname,
        avatarColor: data.avatarColor,
        avatarImage: data.avatarImage,
        bio: data.bio,
        phoneNumber: data.phoneNumber,
        normalizedPhone,
        activityStatus: data.activityStatus,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth,
        publicKey: data.publicKey,
        initials: data.nickname ? data.nickname.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : undefined
      };

      const updatedUser = await userRepository.update(userId, updateData);
      const safeUpdatedUser = privateUserDto(updatedUser);
      
      socket.emit('profile:updated', safeUpdatedUser);
      
      const onlineData = onlineUsers.get(userId);
      if (onlineData) {
        onlineUsers.set(userId, { ...publicUserDto({ ...onlineData, ...updatedUser }), socketId: onlineData.socketId });
        io.emit('users:online', publicUsersDto(Array.from(onlineUsers.values())));
      }
    } catch (err) {
      const duplicate = duplicateProfileMessage(err);
      if (duplicate) {
        socket.emit('profile:update:error', { error: duplicate });
        return;
      }
      if (err.message === INVALID_RUSSIAN_PHONE_MESSAGE) {
        socket.emit('profile:update:error', { error: err.message });
        return;
      }
      console.error('[DB_ERR] Profile update failed:', err);
      socket.emit('profile:update:error', { error: 'Не удалось сохранить профиль' });
    }
  });

  socket.on('disconnect', () => {
    const uId = socketToUserMap.get(socket.id);
    if (uId) {
      onlineUsers.delete(uId);
      socketToUserMap.delete(socket.id);
      io.emit('users:online', publicUsersDto(Array.from(onlineUsers.values())));
    }
  });
};
