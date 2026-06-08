export interface User {
  id: string;
  nickname: string;
  nexaId?: string;
  avatarColor: string;
  avatarImage?: string | null;
  initials: string;
  publicKey?: string | null;
  bio?: string;
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  activityStatus?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  role?: 'user' | 'admin' | 'owner';
  status: 'online' | 'offline';
  balance?: number;
  ownedAvatars?: string; // JSON string from DB
  joinedAt?: Date;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  messageId: string;
}

export interface Message {
  id: string;
  from: User;
  fromId: string;
  toUserId?: string | null;
  toGroupId?: string | null;
  text: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'file';
  data?: string; // Data URL for media
  mediaKind?: 'video-note';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  replyToId?: string | null;
  replyTo?: Message | null;
  reactions?: Reaction[];
  isPinned?: boolean;
  isEdited?: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string | null;
  members: { userId: string; user: User; role: string }[];
  creatorId: string;
  avatarColor: string;
  avatarImage?: string | null;
  initials?: string;
  isGroup: true;
  isPublic?: boolean;
  inviteLink?: string | null;
  createdAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  members: { userId: string; user: User; role: string }[];
  avatarColor: string;
  avatarImage?: string | null;
  initials?: string;
  isChannel: true;
  isPublic?: boolean;
  inviteLink?: string | null;
  createdAt: Date;
}

export interface ChannelPost {
  id: string;
  channelId: string;
  authorId: string;
  content?: string;
  attachments?: string;
  views: number;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  reactions: any[];
}

export type ChatItem = User | Group | Channel;

export interface ChatStateRecord {
  id: string;
  userId: string;
  chatId: string;
  chatType: 'direct' | 'group' | 'channel';
  unread: number;
  mutedUntil?: string | Date | null;
  pinned: boolean;
  archived: boolean;
  lastReadAt?: string | Date | null;
  updatedAt: string | Date;
}
