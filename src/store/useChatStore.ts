import { create } from 'zustand';
import { User, Message, Group, Channel, ChannelPost, ChatStateRecord } from '../types/chat';
import { saveMessageLocally, saveMessagesLocallyBatch } from './localDB';

const chatStateKey = (chatType: ChatStateRecord['chatType'], chatId: string) => `${chatType}:${chatId}`;

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

  setUser: (user) => set({ user }),
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

      // Handle replacing optimistic messages (those starting with opt_)
      const optIndex = existingMessages.findIndex(m => m.id.startsWith('opt_') && m.text === message.text && m.fromId === message.fromId);
      if (optIndex >= 0) {
         const newMessages = [...existingMessages];
         newMessages[optIndex] = message;
         return {
           chats: {
             ...state.chats,
             [chatId]: { messages: newMessages }
           }
         };
      }

      return {
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
    return {
      channelPosts: {
        ...state.channelPosts,
        [channelId]: [post, ...existing].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      }
    };
  })
}));
