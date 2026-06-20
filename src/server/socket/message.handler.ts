import { Server as SocketIOServer } from 'socket.io';
import { groupRepository } from '../repositories/group.repository';
import { messageRepository, safeMessage } from '../repositories/message.repository';
import { chatStateRepository, ChatType } from '../repositories/chat-state.repository';
import { sendMessageSchema, messageHistorySchema, messageReactionSchema, messagePinSchema, messageSearchSchema } from '../validations/message.schema';
import { z } from 'zod';
import { sendPushToMany, sendPushToUser } from '../services/push.service';

const buildMessagePreview = (type: string, text?: string | null, data?: string | null) => {
  if (type === 'image') return 'Фото';
  if (type === 'video') return 'Видео';
  if (type === 'audio') return 'Голосовое сообщение';
  if (type === 'sticker') return 'Стикер';
  const trimmed = (text || '').trim();
  if (trimmed) return trimmed.slice(0, 120);
  if (data) return 'Медиа';
  return 'Новое сообщение';
};

export const handleMessages = (io: SocketIOServer, socket: any, onlineUsers: Map<string, any>) => {
  const userId = socket.userId;

  const emitChatState = async (targetUserId: string, chatId: string, chatType: ChatType) => {
    const targetSocket = onlineUsers.get(targetUserId)?.socketId;
    if (!targetSocket) return;
    const states = await chatStateRepository.findForUser(targetUserId);
    io.to(targetSocket).emit('chat:states', states);
  };

  const chatStateTargetSchema = z.object({
    chatId: z.string().min(1),
    chatType: z.enum(['direct', 'group', 'channel']),
  });

  const updateChatPreferences = async (
    chatId: string,
    chatType: ChatType,
    data: { pinned?: boolean; archived?: boolean; mutedUntil?: Date | null },
  ) => {
    await chatStateRepository.updatePreferences(userId, chatId, chatType, data);
    socket.emit('chat:states', await chatStateRepository.findForUser(userId));
  };

  const isGroupMember = async (groupId: string) => {
    const group = await groupRepository.findById(groupId, true);
    if (!group) return { allowed: false, group: null as any };
    return {
      allowed: group.members.some((member: any) => member.userId === userId),
      group
    };
  };

  const canAccessMessage = async (messageId: string) => {
    const { db } = await import('../../services/db');
    const message = await db.message.findUnique({ where: { id: messageId } });
    if (!message) return { allowed: false, message: null as any };
    if (message.fromId === userId || message.toUserId === userId) {
      return { allowed: true, message };
    }
    if (message.toGroupId) {
      const access = await isGroupMember(message.toGroupId);
      return { allowed: access.allowed, message };
    }
    return { allowed: false, message };
  };

  socket.on('message:history', async (payload: any) => {
    try {
      const { chatId } = messageHistorySchema.parse(payload);
      const group = await groupRepository.findById(chatId);
      const isGroup = !!group;
      if (isGroup) {
        const access = await isGroupMember(chatId);
        if (!access.allowed) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
      }
      const messages = await (isGroup ? messageRepository.getHistoryForGroup(chatId) : messageRepository.getHistoryForDirectMessage(userId, chatId));
      socket.emit('message:history:result', { chatId, messages: messages.reverse() });
    } catch (err) {
      console.error('[DB_ERR] History fetch failed:', err);
    }
  });

  socket.on('message:send', async (payload: any) => {
    try {
      const data = sendMessageSchema.parse(payload);
      const { to, text, type, data: mediaData, replyToId } = data;
      
      const group = await groupRepository.findById(to);
      const isGroup = !!group;
      if (isGroup) {
        const access = await isGroupMember(to);
        if (!access.allowed) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
      }
      
      const directRecipientSocket = !isGroup ? onlineUsers.get(to)?.socketId : null;
      const dbMsg = await messageRepository.create({
        text: text || '',
        type: type || 'text',
        data: mediaData,
        fromId: userId,
        toGroupId: isGroup ? to : null,
        toUserId: !isGroup ? to : null,
        replyToId,
        status: !isGroup && directRecipientSocket ? 'delivered' : 'sent',
      }, true); 

      if (isGroup) {
        const groupWithMembers = await groupRepository.findById(to, true);
        if (groupWithMembers) {
          const enrichedGroupMsg = { ...dbMsg, toGroupId: to };
          await Promise.all(groupWithMembers.members.map(async (m: any) => {
            if (m.userId === userId) {
              await chatStateRepository.touch(m.userId, to, 'group');
            } else {
              await chatStateRepository.incrementUnread(m.userId, to, 'group');
            }
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) io.to(mSocket).emit('message:new', enrichedGroupMsg);
            await emitChatState(m.userId, to, 'group');
          }));
          const offlineMemberIds = groupWithMembers.members
            .filter((member: any) => member.userId !== userId && !onlineUsers.get(member.userId)?.socketId)
            .map((member: any) => member.userId);
          if (offlineMemberIds.length > 0) {
            const senderName = onlineUsers.get(userId)?.nickname || onlineUsers.get(userId)?.username || 'Nexa';
            await sendPushToMany(offlineMemberIds, {
              title: groupWithMembers.name,
              body: `${senderName}: ${buildMessagePreview(type || 'text', text, mediaData)}`,
              kind: 'message',
              chatId: to,
              fromId: userId,
              fromName: senderName,
              url: '/',
            });
          }
        }
      } else {
        const recipientSocket = onlineUsers.get(to)?.socketId;
        await chatStateRepository.touch(userId, to, 'direct');
        if (to === userId) {
          await chatStateRepository.touch(userId, userId, 'direct');
        } else {
          await chatStateRepository.incrementUnread(to, userId, 'direct');
        }
        await emitChatState(userId, to, 'direct');
        if (to !== userId) await emitChatState(to, userId, 'direct');
        if (recipientSocket) io.to(recipientSocket).emit('message:new', dbMsg);
        if (!recipientSocket && to !== userId) {
          const senderName = onlineUsers.get(userId)?.nickname || onlineUsers.get(userId)?.username || 'Nexa';
          await sendPushToUser(to, {
            title: senderName,
            body: buildMessagePreview(type || 'text', text, mediaData),
            kind: 'message',
            chatId: to,
            fromId: userId,
            fromName: senderName,
            url: '/',
          });
        }
        if (to !== userId || !recipientSocket) {
          socket.emit('message:new', dbMsg);
        }
      }
    } catch (err) {
      console.error('[DB_ERR] Message send failed:', err);
    }
  });

  socket.on('message:react', async (payload: any) => {
    try {
      const { messageId, emoji } = messageReactionSchema.parse(payload);
      const access = await canAccessMessage(messageId);
      if (!access.allowed) return;
      const updatedMsg = await messageRepository.toggleReaction(messageId, userId, emoji);
      
      if (updatedMsg) {
        if (updatedMsg.toGroupId) {
           const group = await groupRepository.findById(updatedMsg.toGroupId, true);
           if (group) {
              group.members.forEach(m => {
                const mSocket = onlineUsers.get(m.userId)?.socketId;
                if (mSocket) io.to(mSocket).emit('message:updated', updatedMsg);
              });
           }
        } else {
           const recipientId = updatedMsg.toUserId === userId ? updatedMsg.fromId : updatedMsg.toUserId;
           if (recipientId) {
             const recipientSocket = onlineUsers.get(recipientId)?.socketId;
             if (recipientSocket) io.to(recipientSocket).emit('message:updated', updatedMsg);
           }
           socket.emit('message:updated', updatedMsg);
        }
      }
    } catch(e) { console.error('Reaction error:', e); }
  });

  socket.on('message:pin', async (payload: any) => {
    try {
      const { messageId, isPinned } = messagePinSchema.parse(payload);
      const access = await canAccessMessage(messageId);
      if (!access.allowed) return;
      const updatedMsg = await messageRepository.pinMessage(messageId, isPinned);
      
      if (updatedMsg) {
        if (updatedMsg.toGroupId) {
           const group = await groupRepository.findById(updatedMsg.toGroupId, true);
           if (group) {
              group.members.forEach(m => {
                const mSocket = onlineUsers.get(m.userId)?.socketId;
                if (mSocket) io.to(mSocket).emit('message:updated', updatedMsg);
              });
           }
        } else {
           const recipientId = updatedMsg.toUserId === userId ? updatedMsg.fromId : updatedMsg.toUserId;
           if (recipientId) {
             const recipientSocket = onlineUsers.get(recipientId)?.socketId;
             if (recipientSocket) io.to(recipientSocket).emit('message:updated', updatedMsg);
           }
           socket.emit('message:updated', updatedMsg);
        }
      }
    } catch(e) { console.error('Pin error:', e); }
  });

  socket.on('message:search', async (payload: any) => {
    try {
      const { chatId, query } = messageSearchSchema.parse(payload);
      const group = await groupRepository.findById(chatId);
      const isGroup = !!group;
      if (isGroup) {
        const access = await isGroupMember(chatId);
        if (!access.allowed) {
          socket.emit('error', { message: 'Access denied' });
          return;
        }
      }
      const results = await messageRepository.searchMessages(userId, chatId, query, isGroup);
      socket.emit('message:search:result', { chatId, results });
    } catch(e) { console.error('Search error:', e); }
  });

  socket.on('message:read', async (payload: any) => {
    try {
      const { chatId } = z.object({ chatId: z.string() }).parse(payload);
      const group = await groupRepository.findById(chatId);
      const chatType: ChatType = group ? 'group' : 'direct';
      await messageRepository.markAsRead(chatId, userId);
      await chatStateRepository.markRead(userId, chatId, chatType);
      await emitChatState(userId, chatId, chatType);
      
      const senderSocket = onlineUsers.get(chatId)?.socketId;
      if (senderSocket) {
        io.to(senderSocket).emit('messages:read', { chatId: userId });
      }
    } catch (err) {
      console.error('message:read error:', err);
    }
  });

  socket.on('chat:state:update', async (payload: any) => {
    try {
      const data = z.object({
        chatId: z.string().min(1),
        chatType: z.enum(['direct', 'group', 'channel']),
        pinned: z.boolean().optional(),
        archived: z.boolean().optional(),
        mutedUntil: z.string().datetime().nullable().optional(),
      }).parse(payload);

      const mutedUntil = data.mutedUntil === undefined ? undefined : data.mutedUntil ? new Date(data.mutedUntil) : null;
      await updateChatPreferences(data.chatId, data.chatType, {
        pinned: data.pinned,
        archived: data.archived,
        mutedUntil,
      });
    } catch (err) {
      console.error('chat:state:update error:', err);
    }
  });

  socket.on('chat:pin', async (payload: any) => {
    try {
      const data = chatStateTargetSchema.extend({
        pinned: z.boolean(),
      }).parse(payload);

      await updateChatPreferences(data.chatId, data.chatType, { pinned: data.pinned });
    } catch (err) {
      console.error('chat:pin error:', err);
    }
  });

  socket.on('chat:archive', async (payload: any) => {
    try {
      const data = chatStateTargetSchema.extend({
        archived: z.boolean(),
      }).parse(payload);

      await updateChatPreferences(data.chatId, data.chatType, { archived: data.archived });
    } catch (err) {
      console.error('chat:archive error:', err);
    }
  });

  socket.on('chat:mute', async (payload: any) => {
    try {
      const data = chatStateTargetSchema.extend({
        mutedUntil: z.string().datetime().nullable().optional(),
        muted: z.boolean().optional(),
        durationMs: z.number().int().positive().max(30 * 24 * 60 * 60 * 1000).optional(),
      }).parse(payload);

      const mutedUntil = data.mutedUntil !== undefined
        ? (data.mutedUntil ? new Date(data.mutedUntil) : null)
        : data.muted === false
          ? null
          : new Date(Date.now() + (data.durationMs || 60 * 60 * 1000));

      await updateChatPreferences(data.chatId, data.chatType, { mutedUntil });
    } catch (err) {
      console.error('chat:mute error:', err);
    }
  });

  socket.on('typing', async (payload: { chatId: string; isTyping: boolean } | null | undefined) => {
    try {
      if (!payload || typeof payload !== 'object') return;
      const { chatId, isTyping } = payload;
      if (!chatId) return;

      const user = onlineUsers.get(userId);
      const userName = user?.nickname || user?.username || 'Собеседник';

      const group = await groupRepository.findById(chatId, true);
      const isGroup = !!group;

      if (isGroup) {
        group.members.forEach((m: any) => {
          if (m.userId !== userId) {
            const mSocket = onlineUsers.get(m.userId)?.socketId;
            if (mSocket) {
              io.to(mSocket).emit('typing:update', {
                chatId,
                userId,
                userName,
                isTyping
              });
            }
          }
        });
      } else {
        const recipientSocket = onlineUsers.get(chatId)?.socketId;
        if (recipientSocket) {
          io.to(recipientSocket).emit('typing:update', {
            chatId: userId,
            userId,
            userName,
            isTyping
          });
        }
      }
    } catch (err) {
      console.error('[TYPING_ERR] Error handling typing event:', err);
    }
  });

  socket.on('message:edit', async (payload: { messageId: string; text: string }) => {
    try {
      const { messageId, text } = payload;
      const { db } = await import('../../services/db');
      
      const message = await db.message.findUnique({ where: { id: messageId } });
      if (!message || message.fromId !== userId) return;
      
      const updatedMsg = safeMessage(await db.message.update({
        where: { id: messageId },
        data: { text: text || '', isEdited: true },
        include: { from: true, replyTo: { include: { from: true } }, reactions: true }
      }));
      
      if (updatedMsg.toGroupId) {
         const group = await groupRepository.findById(updatedMsg.toGroupId, true);
         if (group) {
            group.members.forEach(m => {
              const mSocket = onlineUsers.get(m.userId)?.socketId;
              if (mSocket) io.to(mSocket).emit('message:updated', updatedMsg);
            });
         }
      } else {
         const recipientId = updatedMsg.toUserId === userId ? updatedMsg.fromId : updatedMsg.toUserId;
         if (recipientId) {
           const recipientSocket = onlineUsers.get(recipientId)?.socketId;
           if (recipientSocket) io.to(recipientSocket).emit('message:updated', updatedMsg);
         }
         socket.emit('message:updated', updatedMsg);
      }
    } catch (err) {
      console.error('[DB_ERR] Message edit failed:', err);
    }
  });

  socket.on('message:delete', async (payload: { messageId: string }) => {
    try {
      const { messageId } = payload;
      const { db } = await import('../../services/db');
      
      const message = await db.message.findUnique({ where: { id: messageId } });
      if (!message) return;
      
      let canDelete = message.fromId === userId;
      
      if (!canDelete && message.toGroupId) {
        const group = await groupRepository.findById(message.toGroupId, true);
        if (group) {
          const memberRelation = group.members.find(m => m.userId === userId);
          canDelete = group.creatorId === userId || memberRelation?.isCoOwner === true;
        }
      }
      
      if (!canDelete) return;
      
      await db.$transaction([
        db.reaction.deleteMany({ where: { messageId } }),
        db.message.updateMany({ where: { replyToId: messageId }, data: { replyToId: null } }),
        db.message.delete({ where: { id: messageId } })
      ]);
      
      const deletePayload = { messageId, toGroupId: message.toGroupId, toUserId: message.toUserId, fromId: message.fromId };
      
      if (message.toGroupId) {
         const group = await groupRepository.findById(message.toGroupId, true);
         if (group) {
            group.members.forEach(m => {
              const mSocket = onlineUsers.get(m.userId)?.socketId;
              if (mSocket) io.to(mSocket).emit('message:deleted', deletePayload);
            });
         }
      } else {
         const recipientId = message.toUserId === userId ? message.fromId : message.toUserId;
         if (recipientId) {
           const recipientSocket = onlineUsers.get(recipientId)?.socketId;
           if (recipientSocket) io.to(recipientSocket).emit('message:deleted', deletePayload);
         }
         socket.emit('message:deleted', deletePayload);
      }
    } catch (err) {
      console.error('[DB_ERR] Message delete failed:', err);
    }
  });
};
