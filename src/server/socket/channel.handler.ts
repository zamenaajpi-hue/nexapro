import { Server as SocketIOServer } from 'socket.io';
import { channelRepository } from '../repositories/channel.repository';
import { createChannelSchema, updateChannelSchema } from '../validations/group.schema';
import { generateGroupAvatar } from '../../utils/avatarGenerator';
import { safeUser } from '../utils/safeUser';

export const safeChannelMember = (member: any) => ({ ...member, user: member.user ? safeUser(member.user) : member.user });
export const safeChannelPayload = (channel: any) => ({
  ...channel,
  owner: channel.owner ? safeUser(channel.owner) : channel.owner,
  members: Array.isArray(channel.members) ? channel.members.map(safeChannelMember) : channel.members,
});
export const safeChannelPostPayload = (post: any) => ({
  ...post,
  author: post.author ? safeUser(post.author) : post.author,
});

export const handleChannels = (io: SocketIOServer, socket: any, onlineUsers: Map<string, any>) => {
  const userId = socket.userId;

  const getChannelAccess = async (channelId: string) => {
    const channel = await channelRepository.findById(channelId, true);
    if (!channel) return { channel: null as any, member: null as any, canView: false, canManage: false };
    const member = channel.members.find((m: any) => m.userId === userId);
    return {
      channel,
      member,
      canView: Boolean(member) || channel.isPublic === true,
      canManage: member?.role === 'owner' || member?.role === 'admin' || channel.ownerId === userId
    };
  };

  socket.on('channel:create', async (payload: any) => {
    try {
      const { name, description, isPublic } = createChannelSchema.parse(payload);
      const generatedAvatar = generateGroupAvatar(name);

      const newChannel = await channelRepository.create({
        name,
        description,
        isPublic: isPublic || false,
        ownerId: userId,
        avatarColor: '#'+Math.floor(Math.random()*16777215).toString(16),
        avatarImage: generatedAvatar,
        initials: name.substring(0, 2).toUpperCase(),
        members: {
          create: [
            { userId: userId, role: 'owner' }
          ]
        }
      }, true);
      
      const userSocket = onlineUsers.get(userId)?.socketId;
      if (userSocket) {
        io.to(userSocket).emit('channel:new', { ...safeChannelPayload(newChannel), isChannel: true });
      }
    } catch (err) {
      console.error('[DB_ERR] Channel creation failed:', err);
    }
  });

  socket.on('channel:update', async (payload: any) => {
    try {
      const { id, name, avatarImage } = updateChannelSchema.parse(payload);
      const access = await getChannelAccess(id);
      if (!access.canManage) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      const updatedChannel = await channelRepository.update(id, { 
        name, 
        avatarImage,
        initials: name ? name.substring(0, 2).toUpperCase() : undefined
      }, true);
      
      updatedChannel.members.forEach((m: any) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit('channel:updated', { ...safeChannelPayload(updatedChannel), isChannel: true });
      });
    } catch (err) {
      console.error('[DB_ERR] Channel update failed:', err);
    }
  });

  socket.on('channel:add-member', async (payload: any) => {
    try {
      const { channelId, userId: targetUserId } = payload;
      if (typeof channelId !== 'string' || typeof targetUserId !== 'string') return;
      const access = await getChannelAccess(channelId);
      if (!access.canManage) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      await channelRepository.addMember(channelId, targetUserId);

      const updatedChannel = await channelRepository.findById(channelId, true);
      if (updatedChannel) {
        updatedChannel.members.forEach((m: any) => {
          const mSocket = onlineUsers.get(m.userId)?.socketId;
          if (mSocket) io.to(mSocket).emit('channel:updated', { ...safeChannelPayload(updatedChannel), isChannel: true });
        });
      }
    } catch (err) {
      console.error('[DB_ERR] Add channel member failed:', err);
    }
  });

  socket.on('channel:history', async (payload: any) => {
    try {
      const { channelId } = payload;
      if (typeof channelId !== 'string') return;
      const access = await getChannelAccess(channelId);
      if (!access.canView) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      const { db } = await import('../../services/db');
      
      const posts = await db.channelPost.findMany({
        where: { channelId },
        include: { author: true, reactions: true },
        orderBy: { createdAt: 'desc' },
        take: 50
      });
      
      socket.emit('channel:history:result', { channelId, posts: posts.reverse().map(safeChannelPostPayload) });
    } catch (err) {
      console.error('[DB_ERR] Channel history fetch failed:', err);
    }
  });

  socket.on('channel:post:create', async (payload: any) => {
    try {
      const { channelId, content, attachments } = payload;
      if (typeof channelId !== 'string') return;
      const { db } = await import('../../services/db');
      
      const access = await getChannelAccess(channelId);
      const channel = access.channel;
      if (!channel) return;
      
      if (!access.canManage) {
        return; // permission denied
      }

      const post = await db.channelPost.create({
        data: {
          channelId,
          authorId: userId,
          content,
          attachments: typeof attachments === 'string'
            ? attachments
            : attachments
              ? JSON.stringify(attachments)
              : null
        },
        include: { author: true, reactions: true }
      });

      channel.members.forEach((m: any) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit('channel:post:new', { channelId, post: safeChannelPostPayload(post) });
      });
    } catch (err) {
      console.error('[DB_ERR] Channel post creation failed:', err);
    }
  });

  socket.on('channel:post:react', async (payload: any) => {
    try {
      const { postId, emoji } = payload;
      if (typeof postId !== 'string' || typeof emoji !== 'string') return;
      const { db } = await import('../../services/db');
      const targetPost = await db.channelPost.findUnique({ where: { id: postId } });
      if (!targetPost) return;
      const access = await getChannelAccess(targetPost.channelId);
      if (!access.member) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      const existing = await db.channelReaction.findFirst({
        where: {
          userId,
          postId,
          emoji
        }
      });
      
      if (existing) {
        await db.channelReaction.delete({
          where: { id: existing.id }
        });
      } else {
        await db.channelReaction.create({
          data: {
            userId,
            postId,
            emoji
          }
        });
      }
      
      const updatedPost = await db.channelPost.findUnique({
        where: { id: postId },
        include: { author: true, reactions: true }
      });
      
      if (updatedPost) {
        const channel = await channelRepository.findById(updatedPost.channelId, true);
        if (channel) {
          channel.members.forEach((m: any) => {
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) io.to(mSocket).emit('channel:post:updated', { channelId: updatedPost.channelId, post: safeChannelPostPayload(updatedPost) });
          });
        }
      }
    } catch (err) {
      console.error('[DB_ERR] Channel post reaction failed:', err);
    }
  });

  socket.on('channel:post:view', async (payload: any) => {
    try {
      const { postId } = payload;
      if (typeof postId !== 'string') return;
      const { db } = await import('../../services/db');
      const targetPost = await db.channelPost.findUnique({ where: { id: postId } });
      if (!targetPost) return;
      const access = await getChannelAccess(targetPost.channelId);
      if (!access.canView) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      const updatedPost = await db.channelPost.update({
        where: { id: postId },
        data: { views: { increment: 1 } },
        include: { author: true, reactions: true }
      });
      
      const channel = await channelRepository.findById(updatedPost.channelId, true);
      if (channel) {
        channel.members.forEach((m: any) => {
          const mSocket = onlineUsers.get(m.userId)?.socketId;
          if (mSocket) io.to(mSocket).emit('channel:post:updated', { channelId: updatedPost.channelId, post: safeChannelPostPayload(updatedPost) });
        });
      }
    } catch (err) {
      console.error('[DB_ERR] Channel post view increment failed:', err);
    }
  });

  socket.on('channel:delete', async (payload: any) => {
    try {
      const { channelId } = payload;
      if (typeof channelId !== 'string') return;
      const access = await getChannelAccess(channelId);
      if (!access.canManage || !access.channel) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const members = access.channel.members || [];
      await channelRepository.deleteWithRelations(channelId);

      members.forEach((m: any) => {
        const mSocket = onlineUsers.get(m.userId)?.socketId;
        if (mSocket) io.to(mSocket).emit('channel:deleted', { channelId });
      });
    } catch (err) {
      console.error('[DB_ERR] Channel delete failed:', err);
    }
  });
};
