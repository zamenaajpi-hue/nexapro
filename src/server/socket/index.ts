import { Server as SocketIOServer } from 'socket.io';
import { handleMessages } from './message.handler';
import { handleGroups } from './group.handler';
import { handleCalls } from './call.handler';
import { handleUsers } from './user.handler';
import { handleWallet } from './wallet.handler';
import { handleStories } from './story.handler';
import { handleChannels } from './channel.handler';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/auth';

export const setupSocketHandlers = (io: SocketIOServer) => {
  const onlineUsers = new Map<string, any>(); 
  const socketToUserMap = new Map<string, string>(); 

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));

    try {
      jwt.verify(token, getJwtSecret(), (err: any, decoded: any) => {
        if (err || !decoded || typeof decoded !== 'object' || !decoded.userId) {
          return next(new Error('Authentication error'));
        }
        (socket as any).userId = decoded.userId;
        next();
      });
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: any) => {
    const userId = socket.userId;
    console.log(`[AUTH] User connected: ${userId} (Socket: ${socket.id})`);

    handleUsers(io, socket, onlineUsers, socketToUserMap);
    handleWallet(io, socket, onlineUsers);
    handleMessages(io, socket, onlineUsers);
    handleGroups(io, socket, onlineUsers);
    handleChannels(io, socket, onlineUsers);
    handleCalls(io, socket, onlineUsers);
    handleStories(io, socket, onlineUsers);
  });
};
