import { Server as SocketIOServer } from 'socket.io';
import { groupRepository } from '../repositories/group.repository';
import { createGroupSchema, updateGroupSchema } from '../validations/group.schema';
import { generateGroupAvatar } from '../../utils/avatarGenerator';
import { safeUser } from '../utils/safeUser';

export const safeGroupMember = (member: any) => ({ ...member, user: member.user ? safeUser(member.user) : member.user });
export const safeGroupPayload = (group: any) => ({
  ...group,
  creator: group.creator ? safeUser(group.creator) : group.creator,
  members: Array.isArray(group.members) ? group.members.map(safeGroupMember) : group.members,
});

export const handleGroups = (io: SocketIOServer, socket: any, onlineUsers: Map<string, any>) => {
  const userId = socket.userId;

  const canManageGroup = async (groupId: string) => {
    const group = await groupRepository.findById(groupId, true);
    if (!group) return { allowed: false, group: null as any };
    const member = group.members.find((m: any) => m.userId === userId);
    return {
      allowed: group.creatorId === userId || member?.role === 'owner' || member?.role === 'admin' || member?.isCoOwner === true,
      group
    };
  };

  socket.on('group:create', async (payload: any) => {
    try {
      const { name, description, isPublic, members } = createGroupSchema.parse(payload);
      const membersArray = members || [];
      const uniqueMemberIds = Array.from(new Set(membersArray)).filter(id => id !== userId);

      const generatedAvatar = generateGroupAvatar(name);

      const newGroup = await groupRepository.create({
        name,
        description,
        isPublic: isPublic || false,
        creatorId: userId,
        avatarColor: '#'+Math.floor(Math.random()*16777215).toString(16),
        avatarImage: generatedAvatar,
        initials: name.substring(0, 2).toUpperCase(),
        members: {
          create: [
            { userId: userId, role: 'owner', isCoOwner: true },
            ...uniqueMemberIds.map((mId: string) => ({ userId: mId, role: 'member' }))
          ]
        }
      }, true);
      
      newGroup.members.forEach(m => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit('group:new', { ...safeGroupPayload(newGroup), isGroup: true });
      });
    } catch (err) {
      console.error('[DB_ERR] Group creation failed:', err);
    }
  });

  socket.on('group:update', async (payload: any) => {
    try {
      const { id, name, avatarImage } = updateGroupSchema.parse(payload);
      const access = await canManageGroup(id);
      if (!access.allowed) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      const updatedGroup = await groupRepository.update(id, { 
        name, 
        avatarImage,
        initials: name ? name.substring(0, 2).toUpperCase() : undefined
      }, true);
      
      updatedGroup.members.forEach((m: any) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit('group:updated', { ...safeGroupPayload(updatedGroup), isGroup: true });
      });
    } catch (err) {
      console.error('[DB_ERR] Group update failed:', err);
    }
  });

  socket.on('group:add-member', async (payload: any) => {
    try {
      const { groupId, userId: targetUserId } = payload;
      if (typeof groupId !== 'string' || typeof targetUserId !== 'string') return;
      const access = await canManageGroup(groupId);
      if (!access.allowed) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      await groupRepository.addMember(groupId, targetUserId);
      
      const updatedGroup = await groupRepository.findById(groupId, true);
      if (updatedGroup) {
        updatedGroup.members.forEach((m: any) => {
          const mSocket = onlineUsers.get(m.userId)?.socketId;
          if (mSocket) io.to(mSocket).emit('group:updated', { ...safeGroupPayload(updatedGroup), isGroup: true });
        });
      }
    } catch (err) {
      console.error('[DB_ERR] Add group member failed:', err);
    }
  });

  socket.on('group:delete', async (payload: any) => {
    try {
      const { groupId } = payload;
      if (typeof groupId !== 'string') return;
      const access = await canManageGroup(groupId);
      if (!access.allowed || !access.group) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const members = access.group.members || [];
      await groupRepository.deleteWithRelations(groupId);

      members.forEach((m: any) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit('group:deleted', { groupId });
      });
    } catch (err) {
      console.error('[DB_ERR] Group delete failed:', err);
    }
  });
};
