import { Server as SocketIOServer } from 'socket.io';
import { sendPushToUser } from '../services/push.service';

export const handleCalls = (io: SocketIOServer, socket: any, onlineUsers: Map<string, any>) => {
  const userId = socket.userId;

  socket.on('call:initiate', (payload: any) => {
    const { to, type } = payload;
    const sender = onlineUsers.get(userId);
    const callerName = sender?.nickname || sender?.username || 'Nexa';

    if (sender) {
      const recipientSocket = onlineUsers.get(to)?.socketId;
      if (recipientSocket) {
        io.to(recipientSocket).emit('call:incoming', { from: sender, type });
      } else {
        void sendPushToUser(to, {
          title: `@${callerName} звонит`,
          body: type === 'video' ? 'Входящий видеозвонок' : 'Входящий звонок',
          kind: 'call',
          fromId: userId,
          fromName: callerName,
          url: '/',
        });
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
    if (recipientSocket) io.to(recipientSocket).emit('call:ended');
  });
};
