import { Server as SocketIOServer } from 'socket.io';
import { sendPushToUser } from '../services/push.service';
import { publicUserDto } from '../utils/safeUser';
import { groupRepository } from '../repositories/group.repository';

export const safeCallUserPayload = (user: any) => publicUserDto(user);

type GroupCallParticipant = {
  socketId: string;
  userId: string;
  user: any;
  muted: boolean;
  joinedAt: string;
};

type GroupCallRoom = {
  groupId: string;
  memberIds: string[];
  participants: Map<string, GroupCallParticipant>;
};

const groupCallRooms = new Map<string, GroupCallRoom>();

const getGroupCallRoom = (groupId: string) => {
  let room = groupCallRooms.get(groupId);
  if (!room) {
    room = { groupId, memberIds: [], participants: new Map() };
    groupCallRooms.set(groupId, room);
  }
  return room;
};

const groupCallRoomName = (groupId: string) => `group-call:${groupId}`;

const serializeGroupCallRoom = (room: GroupCallRoom) => ({
  groupId: room.groupId,
  participants: Array.from(room.participants.values()).map((participant) => ({
    userId: participant.userId,
    user: safeCallUserPayload(participant.user),
    muted: participant.muted,
    joinedAt: participant.joinedAt,
  })),
});

const emitGroupCallStateToMembers = (io: SocketIOServer, onlineUsers: Map<string, any>, room: GroupCallRoom) => {
  const payload = serializeGroupCallRoom(room);
  room.memberIds.forEach((memberId) => {
    const memberSocketId = onlineUsers.get(memberId)?.socketId;
    if (memberSocketId) io.to(memberSocketId).emit('group-call:state', payload);
  });
};

const emitGroupCallEndedToMembers = (
  io: SocketIOServer,
  onlineUsers: Map<string, any>,
  groupId: string,
  memberIds: string[],
) => {
  memberIds.forEach((memberId) => {
    const memberSocketId = onlineUsers.get(memberId)?.socketId;
    if (memberSocketId) io.to(memberSocketId).emit('group-call:ended', { groupId });
  });
};

export const handleCalls = (io: SocketIOServer, socket: any, onlineUsers: Map<string, any>) => {
  const userId = socket.userId;

  const ensureGroupCallAccess = async (groupId: string) => {
    if (typeof groupId !== 'string' || !groupId.trim()) return { allowed: false, group: null as any };

    const group = await groupRepository.findById(groupId, true);
    if (!group) return { allowed: false, group: null as any };

    return {
      allowed: group.members.some((member: any) => member.userId === userId),
      group,
    };
  };

  const leaveGroupCall = (groupId: string, reason: 'left' | 'disconnect' = 'left') => {
    const room = groupCallRooms.get(groupId);
    if (!room || !room.participants.has(userId)) return;

    room.participants.delete(userId);
    socket.leave(groupCallRoomName(groupId));
    io.to(groupCallRoomName(groupId)).emit('group-call:peer-left', { groupId, userId, reason });

    if (room.participants.size === 0) {
      emitGroupCallEndedToMembers(io, onlineUsers, groupId, room.memberIds);
      groupCallRooms.delete(groupId);
    } else {
      emitGroupCallStateToMembers(io, onlineUsers, room);
    }
  };

  socket.on('call:initiate', (payload: any) => {
    const { to, type } = payload || {};
    if (typeof to !== 'string' || (type !== 'audio' && type !== 'video')) {
      socket.emit('call:error', { error: 'Invalid call request' });
      return;
    }
    if (to === userId) {
      socket.emit('call:error', { error: 'Cannot call yourself' });
      return;
    }
    const sender = onlineUsers.get(userId);
    const callerName = sender?.nickname || sender?.username || 'Nexa';

    if (sender) {
      const recipientSocket = onlineUsers.get(to)?.socketId;
      if (recipientSocket) {
        io.to(recipientSocket).emit('call:incoming', { from: safeCallUserPayload(sender), type });
        socket.emit('call:ringing', { to, type });
      } else {
        void sendPushToUser(to, {
          title: `@${callerName} звонит`,
          body: type === 'video' ? 'Входящий видеозвонок' : 'Входящий звонок',
          kind: 'call',
          fromId: userId,
          fromName: callerName,
          url: '/',
        });
        socket.emit('call:unavailable', { to });
      }
    }
  });

  socket.on('call:accept', (payload: any) => {
    const { to } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit('call:accepted', { fromId: userId });
  });

  socket.on('call:reject', (payload: any) => {
    const { to } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit('call:rejected', { fromId: userId });
  });

  socket.on('call:signal', (payload: any) => {
    const { to, signal } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit('call:signal', { fromId: userId, signal });
  });

  socket.on('call:end', (payload: any) => {
    const { to } = payload;
    const recipientSocket = onlineUsers.get(to)?.socketId;
    if (recipientSocket) io.to(recipientSocket).emit('call:ended', { fromId: userId });
  });

  socket.on('group-call:join', async (payload: any) => {
    try {
      const { groupId } = payload || {};
      const access = await ensureGroupCallAccess(groupId);
      if (!access.allowed || !access.group) {
        socket.emit('group-call:error', { groupId, error: 'Access denied' });
        return;
      }

      const sender = onlineUsers.get(userId);
      if (!sender) {
        socket.emit('group-call:error', { groupId, error: 'User is not online' });
        return;
      }

      const room = getGroupCallRoom(groupId);
      const isNewCall = room.participants.size === 0;
      room.memberIds = access.group.members.map((member: any) => member.userId);
      const existingParticipantIds = Array.from(room.participants.keys()).filter((id) => id !== userId);
      const participant = {
        socketId: socket.id,
        userId,
        user: sender,
        muted: false,
        joinedAt: new Date().toISOString(),
      };

      room.participants.set(userId, participant);
      socket.join(groupCallRoomName(groupId));
      if (isNewCall) {
        const incomingPayload = {
          groupId,
          from: safeCallUserPayload(sender),
          participants: serializeGroupCallRoom(room).participants,
        };
        room.memberIds.forEach((memberId) => {
          if (memberId === userId) return;
          const memberSocketId = onlineUsers.get(memberId)?.socketId;
          if (memberSocketId) io.to(memberSocketId).emit('group-call:incoming', incomingPayload);
        });
      }
      socket.emit('group-call:joined', {
        ...serializeGroupCallRoom(room),
        existingParticipantIds,
      });
      socket.to(groupCallRoomName(groupId)).emit('group-call:peer-joined', {
        groupId,
        participant: {
          userId: participant.userId,
          user: safeCallUserPayload(participant.user),
          muted: participant.muted,
          joinedAt: participant.joinedAt,
        },
      });
      emitGroupCallStateToMembers(io, onlineUsers, room);
    } catch (error) {
      console.error('[CALL_ERR] Group call join failed:', error);
      socket.emit('group-call:error', { error: 'Could not join group call' });
    }
  });

  socket.on('group-call:mute', async (payload: any) => {
    const { groupId, muted } = payload || {};
    const room = groupCallRooms.get(groupId);
    const participant = room?.participants.get(userId);
    if (!room || !participant || typeof muted !== 'boolean') return;

    participant.muted = muted;
    io.to(groupCallRoomName(groupId)).emit('group-call:participant-muted', { groupId, userId, muted });
    emitGroupCallStateToMembers(io, onlineUsers, room);
  });

  socket.on('group-call:signal', async (payload: any) => {
    const { groupId, to, signal } = payload || {};
    const room = groupCallRooms.get(groupId);
    if (!room || !room.participants.has(userId) || !room.participants.has(to) || !signal) return;

    const recipientSocket = room.participants.get(to)?.socketId;
    if (recipientSocket) {
      io.to(recipientSocket).emit('group-call:signal', { groupId, fromId: userId, signal });
    }
  });

  socket.on('group-call:leave', (payload: any) => {
    const { groupId } = payload || {};
    if (typeof groupId === 'string') leaveGroupCall(groupId);
  });

  socket.on('disconnect', () => {
    Array.from(groupCallRooms.keys()).forEach((groupId) => leaveGroupCall(groupId, 'disconnect'));
  });
};
