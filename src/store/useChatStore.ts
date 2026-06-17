import { create } from 'zustand';
import { User, Message, Group, Channel, ChannelPost, ChatStateRecord } from '../types/chat';
import { clearMessagesLocally, saveMessageLocally, saveMessagesLocallyBatch } from './localDB';

const chatStateKey = (chatType: ChatStateRecord['chatType'], chatId: string) => `${chatType}:${chatId}`;
const chatVisibilityStorageKey = (userId: string) => `nexa_chat_visibility:${userId}`;

type ChatVisibilityState = {
  hiddenChats: Record<string, true>;
  chatClearedAt: Record<string, number>;
};

const emptyVisibilityState = (): ChatVisibilityState => ({
  hiddenChats: {},
  chatClearedAt: {},
});

const readChatVisibilityState = (userId?: string | null): ChatVisibilityState => {
  if (!userId || typeof window === 'undefined') return emptyVisibilityState();

  try {
    const raw = localStorage.getItem(chatVisibilityStorageKey(userId));
    if (!raw) return emptyVisibilityState();
    const parsed = JSON.parse(raw);
    return {
      hiddenChats: parsed?.hiddenChats && typeof parsed.hiddenChats === 'object' ? parsed.hiddenChats : {},
      chatClearedAt: parsed?.chatClearedAt && typeof parsed.chatClearedAt === 'object' ? parsed.chatClearedAt : {},
    };
  } catch {
    return emptyVisibilityState();
  }
};

const persistChatVisibilityState = (
  userId: string | null | undefined,
  visibility: ChatVisibilityState,
) => {
  if (!userId || typeof window === 'undefined') return;

  try {
    localStorage.setItem(chatVisibilityStorageKey(userId), JSON.stringify(visibility));
  } catch {
    // Local chat visibility is best-effort; the in-memory state still applies.
  }
};

interface ChatStoreState {
  user: User | null;
  onlineUsers: User[];
  groups: Group[];
  channels: Channel[];
  allUsers: User[];
  activeChat: string | null; // ID of user or group
  chats: Record<string, { messages: Message[] }>;
  channelPosts: Record<string, ChannelPost[]>;
  chatStates: Record<string, ChatStateRecord>;
  hiddenChats: Record<string, true>;
  chatClearedAt: Record<string, number>;
  
  setUser: (user: User | null) => void;
  setOnlineUsers: (users: User[]) => void;
  setGroups: (groups: Group[]) => void;
  setChannels: (channels: Channel[]) => void;
  setAllUsers: (users: User[]) => void;
  setActiveChat: (chatId: string | null) => void;
  setMessages: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessage: (chatId: string, message: Message) => void;
  deleteMessage: (chatId: string, messageId: string) => void;
  clearChat: (chatId: string, chatType: ChatStateRecord['chatType']) => void;
  hideChat: (chatId: string, chatType: ChatStateRecord['chatType']) => void;
  unhideChat: (chatId: string) => void;
  setChatStates: (states: ChatStateRecord[]) => void;
  updateChatState: (state: ChatStateRecord) => void;
  updateGroup: (group: Group) => void;
  addGroup: (group: Group) => void;
  removeGroup: (groupId: string) => void;
  addChannel: (channel: Channel) => void;
  updateChannel: (channel: Channel) => void;
  removeChannel: (channelId: string) => void;
  setChannelPosts: (channelId: string, posts: ChannelPost[]) => void;
  addChannelPost: (channelId: string, post: ChannelPost) => void;
}

export const useChatStore = create<ChatStoreState>((set) => ({
  user: null,
  onlineUsers: [],
  groups: [],
  channels: [],
  allUsers: [],
  activeChat: null,
  chats: {},
  channelPosts: {},
  chatStates: {},
  hiddenChats: {},
  chatClearedAt: {},

  setUser: (user) => {
    const visibility = readChatVisibilityState(user?.id);
    set({ user, ...visibility });
  },
  setOnlineUsers: (onlineUsers) => set({ onlineUsers }),
  setGroups: (groups) => set({ groups }),
  setChannels: (channels) => set({ channels }),
  setAllUsers: (allUsers) => set({ allUsers }),
  setActiveChat: (activeChat) => set({ activeChat }),
  
  setMessages: (chatId, messages) => {
    saveMessagesLocallyBatch(chatId, messages);
    set((state) => ({
      chats: {
        ...state.chats,
        [chatId]: { messages }
      }
    }));
  },

  addMessage: (chatId, message) => {
    saveMessageLocally(chatId, message);
    set((state) => {
      const existingMessages = state.chats[chatId]?.messages || [];
      if (existingMessages.find(m => m.id === message.id)) return state;
      const hiddenChats = { ...state.hiddenChats };
      delete hiddenChats[chatId];

      // Handle replacing optimistic messages (those starting with opt_)
      const optIndex = existingMessages.findIndex(m => m.id.startsWith('opt_') && m.text === message.text && m.fromId === message.fromId);
      if (optIndex >= 0) {
         const newMessages = [...existingMessages];
         newMessages[optIndex] = message;
         persistChatVisibilityState(state.user?.id, { hiddenChats, chatClearedAt: state.chatClearedAt });
         return {
           hiddenChats,
           chats: {
             ...state.chats,
             [chatId]: { messages: newMessages }
           }
         };
      }

      persistChatVisibilityState(state.user?.id, { hiddenChats, chatClearedAt: state.chatClearedAt });
      return {
        hiddenChats,
        chats: {
          ...state.chats,
          [chatId]: {
            messages: [...existingMessages, message]
          }
        }
      };
    });
  },

  updateMessage: (chatId, message) => {
    saveMessageLocally(chatId, message);
    set((state) => {
      const existingMessages = state.chats[chatId]?.messages || [];
      return {
        chats: {
          ...state.chats,
          [chatId]: {
            messages: existingMessages.map(m => m.id === message.id ? message : m)
          }
        }
      };
    });
  },

  deleteMessage: (chatId, messageId) => {
    set((state) => {
      const existingMessages = state.chats[chatId]?.messages || [];
      return {
        chats: {
          ...state.chats,
          [chatId]: {
            messages: existingMessages.filter(m => m.id !== messageId)
          }
        }
      };
    });
  },

  clearChat: (chatId, chatType) => {
    clearMessagesLocally(chatId);
    set((state) => {
      const clearedAt = Date.now();
      const chatClearedAt = { ...state.chatClearedAt, [chatId]: clearedAt };
      const chatStates = { ...state.chatStates };
      const stateKey = chatStateKey(chatType, chatId);
      const existing = chatStates[stateKey];
      if (state.user) {
        chatStates[stateKey] = {
          id: existing?.id || `local-${chatType}-${chatId}`,
          userId: state.user.id,
          chatId,
          chatType,
          unread: 0,
          pinned: existing?.pinned ?? false,
          archived: existing?.archived ?? false,
          mutedUntil: existing?.mutedUntil ?? null,
          lastReadAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      persistChatVisibilityState(state.user?.id, { hiddenChats: state.hiddenChats, chatClearedAt });
      return {
        chatClearedAt,
        chatStates,
        chats: {
          ...state.chats,
          [chatId]: { messages: [] },
        },
        channelPosts: {
          ...state.channelPosts,
          [chatId]: [],
        },
      };
    });
  },

  hideChat: (chatId, chatType) => {
    clearMessagesLocally(chatId);
    set((state) => {
      const hiddenChats = { ...state.hiddenChats, [chatId]: true as const };
      const chatClearedAt = { ...state.chatClearedAt, [chatId]: Date.now() };
      const chats = { ...state.chats };
      const channelPosts = { ...state.channelPosts };
      const chatStates = { ...state.chatStates };
      delete chats[chatId];
      delete channelPosts[chatId];
      delete chatStates[chatStateKey(chatType, chatId)];

      persistChatVisibilityState(state.user?.id, { hiddenChats, chatClearedAt });
      return {
        hiddenChats,
        chatClearedAt,
        chatStates,
        chats,
        channelPosts,
        activeChat: state.activeChat === chatId ? null : state.activeChat,
      };
    });
  },

  unhideChat: (chatId) => {
    set((state) => {
      if (!state.hiddenChats[chatId]) return state;
      const hiddenChats = { ...state.hiddenChats };
      delete hiddenChats[chatId];
      persistChatVisibilityState(state.user?.id, { hiddenChats, chatClearedAt: state.chatClearedAt });
      return { hiddenChats };
    });
  },

  setChatStates: (states) => set(() => ({
    chatStates: states.reduce<Record<string, ChatStateRecord>>((acc, state) => {
      acc[chatStateKey(state.chatType, state.chatId)] = state;
      return acc;
    }, {})
  })),

  updateChatState: (chatState) => set((state) => ({
    chatStates: {
      ...state.chatStates,
      [chatStateKey(chatState.chatType, chatState.chatId)]: chatState,
    }
  })),

  updateGroup: (updatedGroup) => set((state) => ({
    groups: state.groups.map(g => g.id === updatedGroup.id ? updatedGroup : g)
  })),

  addGroup: (newGroup) => set((state) => {
    // Check if group already exists to prevent duplicates
    if (state.groups.find(g => g.id === newGroup.id)) return state;
    return {
      groups: [...state.groups, newGroup]
    };
  }),

  removeGroup: (groupId) => set((state) => ({
    groups: state.groups.filter(g => g.id !== groupId),
    chats: (() => {
      const nextChats = { ...state.chats };
      delete nextChats[groupId];
      return nextChats;
    })()
  })),

  addChannel: (channel) => set((state) => {
    // Check if channel already exists to prevent duplicates
    if (state.channels.find(c => c.id === channel.id)) return state;
    return {
      channels: [...state.channels, channel]
    };
  }),

  updateChannel: (channel) => set((state) => ({
    channels: state.channels.map(c => c.id === channel.id ? channel : c)
  })),

  removeChannel: (channelId) => set((state) => ({
    channels: state.channels.filter(c => c.id !== channelId),
    channelPosts: (() => {
      const nextPosts = { ...state.channelPosts };
      delete nextPosts[channelId];
      return nextPosts;
    })()
  })),

  setChannelPosts: (channelId, posts) => set((state) => ({
    channelPosts: {
      ...state.channelPosts,
      [channelId]: posts
    }
  })),

  addChannelPost: (channelId, post) => set((state) => {
    const existing = state.channelPosts[channelId] || [];
    if (existing.find(p => p.id === post.id)) return state;
    const hiddenChats = { ...state.hiddenChats };
    delete hiddenChats[channelId];
    persistChatVisibilityState(state.user?.id, { hiddenChats, chatClearedAt: state.chatClearedAt });
    return {
      hiddenChats,
      channelPosts: {
        ...state.channelPosts,
        [channelId]: [post, ...existing].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }
    };
  })
}));
