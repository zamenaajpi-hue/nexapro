import { Server as SocketIOServer } from 'socket.io';
import { db } from '../../services/db';
import { privateUserDto, publicUserDto, publicUsersDto } from '../utils/safeUser';

export const handleWallet = (
  io: SocketIOServer, 
  socket: any, 
  onlineUsers: Map<string, any>
) => {
  const userId = socket.userId;

  socket.on('wallet:grant', async (payload: { amount: number }) => {
    try {
      const amount = Number(payload?.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
        socket.emit('error', { message: 'Invalid grant amount' });
        return;
      }

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || user.role !== 'admin') {
        socket.emit('error', { message: 'На то нет прав' });
        return;
      }

      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { balance: { increment: amount } }
      });
      const safeUpdatedUser = privateUserDto(updatedUser);

      socket.emit('profile:updated', safeUpdatedUser);
      
      const onlineData = onlineUsers.get(userId);
      if (onlineData) {
        onlineUsers.set(userId, { ...publicUserDto({ ...onlineData, ...updatedUser }), socketId: onlineData.socketId });
        io.emit('users:online', publicUsersDto(Array.from(onlineUsers.values())));
      }
    } catch (err) {
      console.error('[DB_ERR] Wallet grant failed:', err);
    }
  });

  socket.on('market:get-items', async () => {
    try {
      const items = await db.avatarItem.findMany();
      socket.emit('market:items', items);
    } catch (err) {
      console.error('[DB_ERR] Fetch market items failed:', err);
    }
  });

  socket.on('market:buy-avatar', async (payload: { avatarId: string }) => {
    try {
      const user = await db.user.findUnique({ where: { id: userId } });
      const avatar = await db.avatarItem.findUnique({ where: { id: payload.avatarId } });

      if (!user || !avatar) {
        socket.emit('error', { message: 'Пользователь или товар не найдены' });
        return;
      }

      if (user.balance < avatar.price) {
        socket.emit('error', { message: 'Лопата пуста: недостаточно средств' });
        return;
      }

      const ownedAvatars = JSON.parse(user.ownedAvatars || '[]');
      if (ownedAvatars.includes(avatar.imageUrl)) {
        socket.emit('error', { message: 'Вы уже доминируете с этим аватаром' });
        return;
      }

      ownedAvatars.push(avatar.imageUrl);

      const updatedUser = await db.user.update({
        where: { id: userId },
        data: { 
          balance: { decrement: avatar.price },
          ownedAvatars: JSON.stringify(ownedAvatars)
        }
      });
      const safeUpdatedUser = privateUserDto(updatedUser);

      socket.emit('profile:updated', safeUpdatedUser);
      
      const onlineData = onlineUsers.get(userId);
      if (onlineData) {
        onlineUsers.set(userId, { ...publicUserDto({ ...onlineData, ...updatedUser }), socketId: onlineData.socketId });
        io.emit('users:online', publicUsersDto(Array.from(onlineUsers.values())));
      }
    } catch (err) {
      console.error('[DB_ERR] Buy avatar failed:', err);
    }
  });
};
