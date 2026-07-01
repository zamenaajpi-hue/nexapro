import { Server as SocketIOServer } from 'socket.io';
import { groupRepository } from '../repositories/group.repository';
import { chatStateRepository } from '../repositories/chat-state.repository';
import { createGroupSchema, updateGroupSchema } from '../validations/group.schema';
import { generateGroupAvatar } from '../../utils/avatarGenerator';
import { safeUser } from '../utils/safeUser';
import { isSlugAvailable, makeUniqueSlug, normalizeSlug, validateSlug } from '../publicLinks/publicLink.service';

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
      const { name, description, isPublic, members, slug: requestedSlug } = createGroupSchema.parse(payload);
      const membersArray = members || [];
      const uniqueMemberIds = Array.from(new Set(membersArray)).filter(id => id !== userId);

      const generatedAvatar = generateGroupAvatar(name);
      const slug = isPublic
        ? requestedSlug
          ? normalizeSlug(requestedSlug)
          : await makeUniqueSlug(name)
        : null;
      if (slug && (validateSlug(slug) || !(await isSlugAvailable(slug)))) {
        socket.emit('group:create:error', { error: 'Эта ссылка уже занята или имеет неверный формат' });
        return;
      }

      const newGroup = await groupRepository.create({
        name,
        description,
        isPublic: isPublic || false,
        slug,
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
      const { id, name, avatarImage, description, isPublic, slug: requestedSlug } = updateGroupSchema.parse(payload);
      const access = await canManageGroup(id);
      if (!access.allowed) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      const slug = requestedSlug === undefined ? undefined : normalizeSlug(requestedSlug);
      if (slug && (validateSlug(slug) || !(await isSlugAvailable(slug, { type: 'group', id })))) {
        socket.emit('group:update:error', { error: 'Эта ссылка уже занята или имеет неверный формат' });
        return;
      }
      const updatedGroup = await groupRepository.update(id, { 
        name, 
        avatarImage,
        description,
        isPublic,
        slug,
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
        socket.emit('group:add-member:error', { error: 'Недостаточно прав для добавления участников' });
        return;
      }
      
      await groupRepository.addMember(groupId, targetUserId);
      await chatStateRepository.touch(targetUserId, groupId, 'group');
      
      const updatedGroup = await groupRepository.findById(groupId, true);
      if (updatedGroup) {
        updatedGroup.members.forEach((m: any) => {
          const mSocket = onlineUsers.get(m.userId)?.socketId;
          if (mSocket) io.to(mSocket).emit('group:updated', { ...safeGroupPayload(updatedGroup), isGroup: true });
        });
        const targetSocket = onlineUsers.get(targetUserId)?.socketId;
        if (targetSocket) {
          io.to(targetSocket).emit('group:new', { ...safeGroupPayload(updatedGroup), isGroup: true });
          io.to(targetSocket).emit('chat:states', await chatStateRepository.findForUser(targetUserId));
        }
        socket.emit('group:add-member:success', { groupId, userId: targetUserId });
      }
    } catch (err) {
      console.error('[DB_ERR] Add group member failed:', err);
      socket.emit('group:add-member:error', { error: 'Не удалось добавить участника' });
    }
  });

  socket.on('group:leave', async (payload: any) => {
    try {
      const { groupId } = payload || {};
      if (typeof groupId !== 'string') return;
      const group = await groupRepository.findById(groupId, true);
      const member = group?.members.find((item: any) => item.userId === userId);
      if (!group || !member) {
        socket.emit('group:leave:error', { groupId, error: 'Вы не состоите в этой группе' });
        return;
      }
      if (group.creatorId === userId || member.role === 'owner') {
        socket.emit('group:leave:error', { groupId, error: 'Сначала передайте права владельца другому участнику' });
        return;
      }

      await groupRepository.removeMember(groupId, userId);
      await chatStateRepository.remove(userId, groupId, 'group');
      socket.emit('group:left', { groupId });

      const updatedGroup = await groupRepository.findById(groupId, true);
      updatedGroup?.members.forEach((item: any) => {
        const memberSocket = onlineUsers.get(item.userId)?.socketId;
        if (memberSocket) io.to(memberSocket).emit('group:updated', { ...safeGroupPayload(updatedGroup), isGroup: true });
      });
    } catch (err) {
      console.error('[DB_ERR] Leave group failed:', err);
      socket.emit('group:leave:error', { error: 'Не удалось покинуть группу' });
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
