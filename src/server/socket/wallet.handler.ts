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

  socket.on('wallet:transfer', async (payload: { nickname?: string; amount?: number }) => {
    try {
      const nickname = String(payload?.nickname || '').trim().replace(/^@/, '');
      const amount = Number(payload?.amount);
      if (!nickname || !Number.isFinite(amount) || amount <= 0 || amount > 100000) {
        socket.emit('wallet:transfer:error', { error: 'Проверьте получателя и сумму перевода' });
        return;
      }

      const result = await db.$transaction(async (tx) => {
        const sender = await tx.user.findUnique({ where: { id: userId } });
        const recipient = await tx.user.findUnique({ where: { nickname } });
        if (!sender) throw new Error('Аккаунт отправителя не найден');
        if (!recipient) throw new Error('Пользователь не найден');
        if (recipient.id === sender.id) throw new Error('Нельзя перевести средства самому себе');

        const debit = await tx.user.updateMany({
          where: { id: sender.id, balance: { gte: amount } },
          data: { balance: { decrement: amount } },
        });
        if (debit.count !== 1) throw new Error('Недостаточно средств');

        await tx.user.update({
          where: { id: recipient.id },
          data: { balance: { increment: amount } },
        });
        const updatedSender = await tx.user.findUnique({ where: { id: sender.id } });
        return { updatedSender, recipient };
      });

      if (!result.updatedSender) throw new Error('Не удалось обновить баланс');
      const safeUpdatedSender = privateUserDto(result.updatedSender);
      socket.emit('profile:updated', safeUpdatedSender);
      socket.emit('wallet:transfer:success', {
        nickname: result.recipient.nickname,
        amount,
        balance: result.updatedSender.balance,
      });

      const senderOnline = onlineUsers.get(userId);
      if (senderOnline) {
        onlineUsers.set(userId, {
          ...publicUserDto({ ...senderOnline, ...result.updatedSender }),
          socketId: senderOnline.socketId,
        });
      }

      const recipientOnline = onlineUsers.get(result.recipient.id);
      if (recipientOnline?.socketId) {
        const refreshedRecipient = await db.user.findUnique({ where: { id: result.recipient.id } });
        if (refreshedRecipient) {
          io.to(recipientOnline.socketId).emit('profile:updated', privateUserDto(refreshedRecipient));
          onlineUsers.set(result.recipient.id, {
            ...publicUserDto({ ...recipientOnline, ...refreshedRecipient }),
            socketId: recipientOnline.socketId,
          });
        }
      }
      io.emit('users:online', publicUsersDto(Array.from(onlineUsers.values())));
    } catch (err: any) {
      socket.emit('wallet:transfer:error', {
        error: err?.message || 'Не удалось выполнить перевод',
      });
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
        socket.emit('market:purchase:error', { error: 'Пользователь или товар не найдены' });
        return;
      }

      if (user.balance < avatar.price) {
        socket.emit('market:purchase:error', { error: 'Недостаточно средств' });
        return;
      }

      const ownedAvatars = JSON.parse(user.ownedAvatars || '[]');
      if (ownedAvatars.includes(avatar.imageUrl)) {
        socket.emit('market:purchase:error', { error: 'Этот аватар уже куплен' });
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
      socket.emit('market:purchase:success', {
        avatarId: avatar.id,
        imageUrl: avatar.imageUrl,
        balance: updatedUser.balance,
      });
      
      const onlineData = onlineUsers.get(userId);
      if (onlineData) {
        onlineUsers.set(userId, { ...publicUserDto({ ...onlineData, ...updatedUser }), socketId: onlineData.socketId });
        io.emit('users:online', publicUsersDto(Array.from(onlineUsers.values())));
      }
    } catch (err) {
      console.error('[DB_ERR] Buy avatar failed:', err);
      socket.emit('market:purchase:error', { error: 'Не удалось купить аватар' });
    }
  });
};
