import { Server as SocketIOServer } from 'socket.io';
import { channelRepository } from '../repositories/channel.repository';
import { chatStateRepository } from '../repositories/chat-state.repository';
import { createChannelSchema, updateChannelSchema } from '../validations/group.schema';
import { generateGroupAvatar } from '../../utils/avatarGenerator';
import { safeUser } from '../utils/safeUser';
import { isSlugAvailable, makeUniqueSlug, normalizeSlug, validateSlug } from '../publicLinks/publicLink.service';

export const safeChannelMember = (member: any) => ({ ...member, user: member.user ? safeUser(member.user) : member.user });
export const safeChannelPayload = (channel: any) => ({
  ...channel,
  owner: channel.owner ? safeUser(channel.owner) : channel.owner,
  members: Array.isArray(channel.members) ? channel.members.map(safeChannelMember) : channel.members,
});
export const safeChannelPostPayload = (post: any) => ({
  ...post,
  author: post.author ? safeUser(post.author) : post.author,
  comments: Array.isArray(post.comments) ? post.comments.map(safeChannelCommentPayload) : post.comments,
  commentsCount: post._count?.comments ?? post.commentsCount ?? (Array.isArray(post.comments) ? post.comments.length : 0),
});

export function safeChannelCommentPayload(comment: any) {
  return {
    ...comment,
    author: comment.author ? safeUser(comment.author) : comment.author,
  };
}

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

  const emitChannelUpdated = (channel: any) => {
    channel.members.forEach((m: any) => {
      const mSocket = onlineUsers.get(m.userId)?.socketId;
      if (mSocket) io.to(mSocket).emit('channel:updated', { ...safeChannelPayload(channel), isChannel: true });
    });
  };

  const emitToChannelMembers = (channel: any, event: string, payload: any) => {
    channel.members.forEach((m: any) => {
      const mSocket = onlineUsers.get(m.userId)?.socketId;
      if (mSocket) io.to(mSocket).emit(event, payload);
    });
  };

  socket.on('channel:create', async (payload: any) => {
    try {
      const { name, description, isPublic, slug: requestedSlug } = createChannelSchema.parse(payload);
      const generatedAvatar = generateGroupAvatar(name);
      const slug = isPublic
        ? requestedSlug
          ? normalizeSlug(requestedSlug)
          : await makeUniqueSlug(name)
        : null;
      if (slug && (validateSlug(slug) || !(await isSlugAvailable(slug)))) {
        socket.emit('channel:create:error', { error: 'Эта ссылка уже занята или имеет неверный формат' });
        return;
      }

      const newChannel = await channelRepository.create({
        name,
        description,
        isPublic: isPublic || false,
        slug,
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
      const { id, name, avatarImage, description, isPublic, slug: requestedSlug } = updateChannelSchema.parse(payload);
      const access = await getChannelAccess(id);
      if (!access.canManage) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      
      const slug = requestedSlug === undefined ? undefined : normalizeSlug(requestedSlug);
      if (slug && (validateSlug(slug) || !(await isSlugAvailable(slug, { type: 'channel', id })))) {
        socket.emit('channel:update:error', { error: 'Эта ссылка уже занята или имеет неверный формат' });
        return;
      }
      const updatedChannel = await channelRepository.update(id, { 
        name, 
        avatarImage,
        description,
        isPublic,
        slug,
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
        socket.emit('channel:add-member:error', { error: 'Недостаточно прав для добавления подписчиков' });
        return;
      }

      await channelRepository.addMember(channelId, targetUserId);
      await chatStateRepository.touch(targetUserId, channelId, 'channel');

      const updatedChannel = await channelRepository.findById(channelId, true);
      if (updatedChannel) {
        emitChannelUpdated(updatedChannel);
        const targetSocket = onlineUsers.get(targetUserId)?.socketId;
        if (targetSocket) {
          io.to(targetSocket).emit('channel:new', { ...safeChannelPayload(updatedChannel), isChannel: true });
          io.to(targetSocket).emit('chat:states', await chatStateRepository.findForUser(targetUserId));
        }
        socket.emit('channel:add-member:success', { channelId, userId: targetUserId });
      }
    } catch (err) {
      console.error('[DB_ERR] Add channel member failed:', err);
      socket.emit('channel:add-member:error', { error: 'Не удалось добавить подписчика' });
    }
  });

  socket.on('channel:leave', async (payload: any) => {
    try {
      const { channelId } = payload || {};
      if (typeof channelId !== 'string') return;
      const access = await getChannelAccess(channelId);
      if (!access.channel || !access.member) {
        socket.emit('channel:leave:error', { channelId, error: 'Вы не подписаны на этот канал' });
        return;
      }
      if (access.channel.ownerId === userId || access.member.role === 'owner') {
        socket.emit('channel:leave:error', { channelId, error: 'Сначала передайте права владельца другому участнику' });
        return;
      }

      await channelRepository.removeMember(channelId, userId);
      await chatStateRepository.remove(userId, channelId, 'channel');
      socket.emit('channel:left', { channelId });

      const updatedChannel = await channelRepository.findById(channelId, true);
      if (updatedChannel) emitChannelUpdated(updatedChannel);
    } catch (err) {
      console.error('[DB_ERR] Leave channel failed:', err);
      socket.emit('channel:leave:error', { error: 'Не удалось покинуть канал' });
    }
  });

  socket.on('channel:member-role', async (payload: any) => {
    try {
      const { channelId, userId: targetUserId, role } = payload || {};
      if (typeof channelId !== 'string' || typeof targetUserId !== 'string') return;
      if (role !== 'admin' && role !== 'subscriber') return;

      const access = await getChannelAccess(channelId);
      if (!access.channel || access.channel.ownerId !== userId) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }
      if (targetUserId === access.channel.ownerId) return;

      await channelRepository.setMemberRole(channelId, targetUserId, role);
      const updatedChannel = await channelRepository.findById(channelId, true);
      if (updatedChannel) emitChannelUpdated(updatedChannel);
    } catch (err) {
      console.error('[DB_ERR] Channel member role update failed:', err);
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
        include: { author: true, reactions: true, _count: { select: { comments: true } } },
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
        include: { author: true, reactions: true, _count: { select: { comments: true } } }
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
        include: { author: true, reactions: true, _count: { select: { comments: true } } }
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

      const updatedPost = await db.$transaction(async (tx: any) => {
        try {
          await tx.channelPostView.create({
            data: { userId, postId }
          });
        } catch (err: any) {
          if (err?.code === 'P2002') return null;
          throw err;
        }

        return tx.channelPost.update({
          where: { id: postId },
          data: { views: { increment: 1 } },
          include: { author: true, reactions: true, _count: { select: { comments: true } } }
        });
      });

      if (!updatedPost) return;
      
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

  socket.on('channel:comments:history', async (payload: any) => {
    try {
      const { postId } = payload || {};
      if (typeof postId !== 'string') return;
      const { db } = await import('../../services/db');
      const post = await db.channelPost.findUnique({ where: { id: postId } });
      if (!post) return;
      const access = await getChannelAccess(post.channelId);
      if (!access.canView) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const comments = await db.channelComment.findMany({
        where: { postId },
        include: { author: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });

      socket.emit('channel:comments:history:result', {
        channelId: post.channelId,
        postId,
        comments: comments.map(safeChannelCommentPayload),
      });
    } catch (err) {
      console.error('[DB_ERR] Channel comments history failed:', err);
    }
  });

  socket.on('channel:comment:create', async (payload: any) => {
    try {
      const { postId, text } = payload || {};
      if (typeof postId !== 'string' || typeof text !== 'string' || !text.trim()) return;
      const { db } = await import('../../services/db');
      const post = await db.channelPost.findUnique({ where: { id: postId } });
      if (!post) return;
      const access = await getChannelAccess(post.channelId);
      if (!access.canView) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const comment = await db.channelComment.create({
        data: {
          postId,
          authorId: userId,
          text: text.trim().slice(0, 2000),
        },
        include: { author: true },
      });
      const commentsCount = await db.channelComment.count({ where: { postId } });
      const payloadToSend = {
        channelId: post.channelId,
        postId,
        comment: safeChannelCommentPayload(comment),
        commentsCount,
      };

      const channel = await channelRepository.findById(post.channelId, true);
      if (channel) {
        emitToChannelMembers(channel, 'channel:comment:new', payloadToSend);
      } else {
        socket.emit('channel:comment:new', payloadToSend);
      }
    } catch (err) {
      console.error('[DB_ERR] Channel comment create failed:', err);
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
