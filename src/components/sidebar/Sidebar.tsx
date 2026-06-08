import React, { useMemo, useState } from 'react';
import { Archive, BellOff, Menu, Pin, PinOff } from 'lucide-react';
import { useChatStore } from '../../store/useChatStore';
import { NexaLogo } from '../../shared/ui/NexaLogo';
import { getInitials } from '../../utils/helpers';
import { DecryptedText } from '../DecryptedText';
import { StoriesBar } from '../stories/StoriesBar';
import { socket } from '../../socket/client';
import type { Channel, ChatItem, ChatStateRecord, Group, Message, User } from '../../types/chat';

interface SidebarProps {
  setShowAdminPanel: (show: boolean) => void;
  setShowGroupModal: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowMenuDrawer: (show: boolean) => void;
  setShowCallsModal: (show: boolean) => void;
  isMobileActive?: boolean;
}

type FolderType = 'all' | 'personal' | 'groups' | 'channels' | 'pinned' | 'archive';
type ChatType = ChatStateRecord['chatType'];

const chatStateKey = (chatType: ChatType, chatId: string) => `${chatType}:${chatId}`;

const isGroupItem = (item: ChatItem): item is Group => 'isGroup' in item;
const isChannelItem = (item: ChatItem): item is Channel => 'isChannel' in item;

const getChatType = (item: ChatItem): ChatType => {
  if (isChannelItem(item)) return 'channel';
  if (isGroupItem(item)) return 'group';
  return 'direct';
};

const getItemName = (item: ChatItem) => ('name' in item ? item.name : item.nickname);

const getMessageTime = (value?: Date | string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  return isToday
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
};

const isMutedNow = (state?: ChatStateRecord) => {
  if (!state?.mutedUntil) return false;
  return new Date(state.mutedUntil).getTime() > Date.now();
};

const getFallbackPreview = (item: ChatItem) => {
  if (isChannelItem(item)) return 'Канал создан';
  if (isGroupItem(item)) return 'Группа создана';
  return 'Нет сообщений';
};

export const Sidebar: React.FC<SidebarProps> = ({
  setShowMenuDrawer,
  isMobileActive,
}) => {
  const {
    user,
    onlineUsers,
    groups,
    channels,
    activeChat,
    setActiveChat,
    chats,
    allUsers,
    chatStates,
    channelPosts,
  } = useChatStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFolder, setActiveFolder] = useState<FolderType>('all');

  const displayUsersList = useMemo(() => {
    if (!user) return [];

    const merged = [...allUsers];
    onlineUsers.forEach((onlineUser) => {
      if (!merged.some((knownUser) => knownUser.id === onlineUser.id)) {
        merged.push(onlineUser);
      }
    });

    if (searchTerm.trim()) {
      return merged.filter((knownUser) => knownUser.id !== user.id);
    }

    const chatUserIds = Object.keys(chats);
    return merged.filter((knownUser) =>
      knownUser.id !== user.id &&
      (chatUserIds.includes(knownUser.id) || knownUser.id === activeChat || onlineUsers.some((onlineUser) => onlineUser.id === knownUser.id))
    );
  }, [onlineUsers, allUsers, chats, activeChat, user?.id, searchTerm]);

  const updateChatState = (
    item: ChatItem,
    data: Partial<Pick<ChatStateRecord, 'pinned' | 'archived' | 'mutedUntil'>>,
  ) => {
    socket.emit('chat:state:update', {
      chatId: item.id,
      chatType: getChatType(item),
      ...data,
    });
  };

  const items = useMemo(() => {
    if (!user) return [];

    const term = searchTerm.toLowerCase().trim();

    return ([...groups, ...channels, ...displayUsersList] as ChatItem[])
      .map((item) => {
        const chatType = getChatType(item);
        const state = chatStates[chatStateKey(chatType, item.id)];
        const isChannel = chatType === 'channel';
        const lastPost = isChannel ? channelPosts[item.id]?.slice(-1)[0] : null;
        const lastMessage = !isChannel ? chats[item.id]?.messages.slice(-1)[0] : null;
        const lastActivity = lastPost?.createdAt || lastMessage?.timestamp || state?.updatedAt || ('createdAt' in item ? item.createdAt : null);
        const name = getItemName(item);

        return {
          item,
          chatType,
          state,
          name,
          isChannel,
          isGroup: chatType === 'group',
          lastPost,
          lastMessage,
          lastActivity,
          activityTime: lastActivity ? new Date(lastActivity).getTime() : 0,
        };
      })
      .filter(({ item, chatType, state, name, lastMessage }) => {
        const archived = state?.archived === true;
        if (activeFolder === 'archive') {
          if (!archived) return false;
        } else if (archived) {
          return false;
        }

        if (activeFolder === 'personal' && chatType !== 'direct') return false;
        if (activeFolder === 'groups' && chatType !== 'group') return false;
        if (activeFolder === 'channels' && chatType !== 'channel') return false;
        if (activeFolder === 'pinned' && !state?.pinned) return false;

        if (!term) {
          if (chatType !== 'direct') return true;
          return !!lastMessage || activeChat === item.id || !!state;
        }

        if (chatType !== 'direct') {
          return name.toLowerCase().includes(term);
        }

        const directUser = item as User;
        return (
          name.toLowerCase().includes(term) ||
          (directUser.nexaId || '').toLowerCase().includes(term) ||
          (directUser.email || '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        if (!!a.state?.pinned !== !!b.state?.pinned) return a.state?.pinned ? -1 : 1;
        return b.activityTime - a.activityTime;
      });
  }, [activeChat, activeFolder, channelPosts, channels, chatStates, chats, displayUsersList, groups, searchTerm, user]);

  if (!user) return null;

  return (
    <aside className={`sidebar ${isMobileActive ? 'mobile-active' : ''}`}>
      <div className="sidebar-header" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            title="Открыть меню"
            onClick={() => setShowMenuDrawer(true)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', borderRadius: '50%', transition: 'background 0.2s' }}
          >
            <Menu size={22} />
          </button>
          <NexaLogo size={34} showText={true} tagline="СЕТЬ" />
        </div>
      </div>

      <StoriesBar />

      <div className="search-bar">
        <input
          type="text"
          placeholder="Поиск чатов и людей..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="tabs chat-folder-tabs">
        {[
          ['all', 'Все'],
          ['personal', 'Личные'],
          ['groups', 'Группы'],
          ['channels', 'Каналы'],
          ['pinned', 'Закреп'],
          ['archive', 'Архив'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`tab-btn ${activeFolder === id ? 'active' : ''}`}
            onClick={() => setActiveFolder(id as FolderType)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="contacts-list">
        {items.map(({ item, chatType, state, name, lastMessage, lastPost, lastActivity }) => {
          const isDirect = chatType === 'direct';
          const isOutgoing = lastMessage?.fromId === user.id;
          const unread = state?.unread || 0;
          const muted = isMutedNow(state);
          const preview = lastPost
            ? (lastPost.content || 'Медиа')
            : lastMessage
              ? getMessagePreview(lastMessage, item, user, chatType === 'group', isOutgoing)
              : getFallbackPreview(item);

          return (
            <div
              key={`${chatType}:${item.id}`}
              className={`user-item chat-list-item ${activeChat === item.id ? 'active' : ''}`}
              onClick={() => setActiveChat(item.id)}
            >
              <div
                className="avatar"
                style={{
                  backgroundColor: item.avatarColor,
                  backgroundImage: item.avatarImage ? `url(${item.avatarImage})` : 'none',
                  position: 'relative',
                }}
              >
                {!item.avatarImage && ((item && 'initials' in item ? item.initials : null) || getInitials(name))}
                {isDirect && (
                  <span
                    className={`presence-dot ${onlineUsers.some((onlineUser) => onlineUser.id === item.id) ? 'online' : ''}`}
                  />
                )}
              </div>

              <div className="user-info chat-row-main">
                <div className="chat-row-title">
                  <span className="user-name">
                    {chatType === 'group' && <span className="group-tag">Группа</span>}
                    {chatType === 'channel' && <span className="group-tag channel-tag">Канал</span>}
                    {state?.pinned && <Pin size={12} className="chat-inline-icon" />}
                    {muted && <BellOff size={12} className="chat-inline-icon" />}
                    {name}
                  </span>
                  <span className="chat-time">{getMessageTime(lastActivity)}</span>
                </div>

                <div className="chat-row-subtitle">
                  <span className="user-status chat-preview">
                    {isDirect && (item as User).nexaId && (
                      <span className="font-mono chat-nexa-id">{(item as User).nexaId}</span>
                    )}
                    {preview}
                  </span>
                  {unread > 0 && !muted && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
                  {unread > 0 && muted && <span className="unread-dot" />}
                </div>
              </div>

              <div className="chat-row-actions">
                <button
                  type="button"
                  title={state?.pinned ? 'Открепить' : 'Закрепить'}
                  onClick={(event) => {
                    event.stopPropagation();
                    updateChatState(item, { pinned: !state?.pinned });
                  }}
                >
                  {state?.pinned ? <PinOff size={15} /> : <Pin size={15} />}
                </button>
                <button
                  type="button"
                  title={muted ? 'Включить звук' : 'Без звука на 1 час'}
                  onClick={(event) => {
                    event.stopPropagation();
                    updateChatState(item, {
                      mutedUntil: muted ? null : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    });
                  }}
                >
                  <BellOff size={15} />
                </button>
                <button
                  type="button"
                  title={state?.archived ? 'Вернуть из архива' : 'В архив'}
                  onClick={(event) => {
                    event.stopPropagation();
                    updateChatState(item, { archived: !state?.archived });
                  }}
                >
                  <Archive size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '10px' }}>
        <div className="user-item" style={{ border: 'none', padding: 0 }}>
          <div
            className="avatar"
            style={{
              backgroundColor: user.avatarColor,
              backgroundImage: user.avatarImage ? `url(${user.avatarImage})` : 'none',
            }}
          >
            {!user.avatarImage && user.initials}
          </div>
          <div
            className="user-info"
            style={{ cursor: 'pointer' }}
            title="Нажмите, чтобы скопировать ID"
            onClick={() => {
              if (user.nexaId) {
                void navigator.clipboard.writeText(user.nexaId);
              }
            }}
          >
            <span className="user-name">{user.nickname}</span>
            <span className="user-status" style={{ color: 'var(--accent-color)', fontWeight: 600 }}>
              {user.nexaId || 'В сети'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

function getMessagePreview(
  message: Message,
  item: ChatItem,
  currentUser: User,
  isGroupChat: boolean,
  isOutgoing: boolean,
) {
  if (message.type === 'text') {
    return (
      <DecryptedText
        text={message.text || ''}
        isGroupChat={isGroupChat}
        isOutgoing={isOutgoing}
        userPublicKey={currentUser.publicKey}
        senderPublicKey={'publicKey' in item ? item.publicKey : null}
        showLockIcon={true}
        plainTextFormat={true}
      />
    );
  }

  const labels: Record<string, string> = {
    image: 'Фото',
    video: 'Видео',
    audio: 'Голосовое',
    sticker: 'Стикер',
    file: 'Файл',
  };
  return message.text || labels[message.type] || 'Медиа';
}
