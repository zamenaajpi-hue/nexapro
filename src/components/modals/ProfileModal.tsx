import React, { useEffect, useMemo, useState } from 'react';
import {
  BellOff,
  Copy,
  FileText,
  Link as LinkIcon,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Phone,
  Shield,
  Trash2,
  UserPlus,
  Video,
  Volume2,
  X,
} from 'lucide-react';
import { Channel, Group, Message, User } from '../../types/chat';
import { getInitials } from '../../utils/helpers';
import { resolveApiUrl } from '../../utils/api';

interface ProfileModalProps {
  onClose: () => void;
  profileItem: User | Group | Channel;
  onlineUsers?: User[];
  socket?: any;
  currentUser?: User;
  messages?: Message[];
  onOpenChat?: (chatId: string) => void;
  onStartCall?: (target: User, type: 'audio' | 'video') => void;
}

type TabKey = 'media' | 'files' | 'voice' | 'links';

const isUserProfile = (item: User | Group | Channel): item is User => !('members' in item);
const isChannelProfile = (item: User | Group | Channel): item is Channel => 'isChannel' in item && item.isChannel;
const isGroupProfile = (item: User | Group | Channel): item is Group => 'isGroup' in item && item.isGroup;
const profileName = (item: User | Group | Channel) => ('name' in item ? item.name : item.nickname);

const mediaUrl = (value?: string | null) => {
  if (!value) return '';
  return value.startsWith('/') ? resolveApiUrl(value) : value;
};

const extractLinks = (messages: Message[]) =>
  messages.flatMap((message) => message.text?.match(/https?:\/\/[^\s]+/g) || []);

export const ProfileModal: React.FC<ProfileModalProps> = ({
  onClose,
  profileItem,
  onlineUsers = [],
  socket,
  currentUser,
  messages = [],
  onOpenChat,
  onStartCall,
}) => {
  const [showAddList, setShowAddList] = useState(false);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('media');
  const [copied, setCopied] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => localStorage.getItem(`nexa_profile_muted:${profileItem.id}`) === 'true');

  const isUser = isUserProfile(profileItem);
  const isChannel = isChannelProfile(profileItem);
  const isGroupOrChannel = isGroupProfile(profileItem) || isChannel;
  const itemName = profileName(profileItem);
  const avatarImage = mediaUrl(profileItem.avatarImage);
  const avatarInitials = ('initials' in profileItem ? profileItem.initials : null) || getInitials(itemName);
  const isOnline = isUser && (profileItem.id === currentUser?.id || onlineUsers.some((item) => item.id === profileItem.id));

  const mediaMessages = useMemo(() => messages.filter((message) => message.type === 'image' || message.type === 'video'), [messages]);
  const fileMessages = useMemo(() => messages.filter((message) => message.type === 'file'), [messages]);
  const voiceMessages = useMemo(() => messages.filter((message) => message.type === 'audio'), [messages]);
  const links = useMemo(() => extractLinks(messages), [messages]);

  const groupMemberIds = isGroupOrChannel && 'members' in profileItem ? (profileItem.members || []).map((member) => member.userId) : [];
  const addableUsers = onlineUsers.filter((user) => !groupMemberIds.includes(user.id));

  const copyText = async (label: string, text?: string | null) => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const toggleSound = () => {
    const nextMuted = !soundMuted;
    setSoundMuted(nextMuted);
    localStorage.setItem(`nexa_profile_muted:${profileItem.id}`, String(nextMuted));

    if (socket && isUser) {
      socket.emit('chat:mute', {
        chatId: profileItem.id,
        chatType: 'direct',
        mutedUntil: nextMuted ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() : null,
      });
    }
  };

  const handleAddMember = (userId: string) => {
    if (!socket || !isGroupOrChannel) return;
    if (isChannel) socket.emit('channel:add-member', { channelId: profileItem.id, userId });
    else socket.emit('group:add-member', { groupId: profileItem.id, userId });
    setShowAddList(false);
  };

  const toggleCoOwner = (userId: string) => {
    const isOwner = ('creatorId' in profileItem && profileItem.creatorId === currentUser?.id) || ('ownerId' in profileItem && profileItem.ownerId === currentUser?.id);
    if (!socket || !isChannel || !isOwner || !('members' in profileItem)) return;
    const member = profileItem.members.find((item) => item.userId === userId);
    const nextRole = member?.role === 'admin' ? 'subscriber' : 'admin';
    socket.emit('channel:member-role', { channelId: profileItem.id, userId, role: nextRole });
  };

  const canDelete = isGroupOrChannel && currentUser && (
    ('creatorId' in profileItem && profileItem.creatorId === currentUser.id) ||
    ('ownerId' in profileItem && profileItem.ownerId === currentUser.id)
  );

  const handleDeleteChat = () => {
    if (!socket || !canDelete) return;
    const label = isChannel ? 'канал' : 'группу';
    if (!confirm(`Удалить ${label}? Это действие удалит чат и связанные сообщения.`)) return;
    if (isChannel) socket.emit('channel:delete', { channelId: profileItem.id });
    else socket.emit('group:delete', { groupId: profileItem.id });
    onClose();
  };

  useEffect(() => {
    if (!showAvatarLightbox) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowAvatarLightbox(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAvatarLightbox]);

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'media', label: 'Медиа', count: mediaMessages.length },
    { key: 'files', label: 'Файлы', count: fileMessages.length },
    { key: 'voice', label: 'Голосовые', count: voiceMessages.length },
    { key: 'links', label: 'Ссылки', count: links.length },
  ];

  const renderTabContent = () => {
    if (!isUser) return null;

    if (activeTab === 'media') {
      return mediaMessages.length ? (
        <div className="public-profile-media-grid">
          {mediaMessages.slice(0, 12).map((message) => (
            <div key={message.id} className="public-profile-media-cell">
              {message.type === 'image' && message.data ? (
                <a href={mediaUrl(message.data)} target="_blank" rel="noreferrer" aria-label="Открыть изображение">
                  <img src={mediaUrl(message.data)} alt="" />
                </a>
              ) : message.data ? (
                <video src={mediaUrl(message.data)} controls playsInline />
              ) : (
                <Video size={22} />
              )}
            </div>
          ))}
        </div>
      ) : <div className="public-profile-empty">Медиа пока нет</div>;
    }

    if (activeTab === 'files') {
      return fileMessages.length ? (
        <div className="public-profile-list">
          {fileMessages.map((message) => (
            <a key={message.id} href={mediaUrl(message.data)} target="_blank" rel="noreferrer">
              <FileText size={18} />
              <span>{message.text || 'Файл'}</span>
            </a>
          ))}
        </div>
      ) : <div className="public-profile-empty">Файлов пока нет</div>;
    }

    if (activeTab === 'voice') {
      return voiceMessages.length ? (
        <div className="public-profile-voice-list">
          {voiceMessages.map((message) => (
            <div key={message.id} className="public-profile-voice-row">
              <Mic size={18} />
              <div>
                <span>{message.text || 'Голосовое сообщение'}</span>
                {message.data ? <audio src={mediaUrl(message.data)} controls preload="metadata" /> : <small>Файл недоступен</small>}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="public-profile-empty">Голосовых пока нет</div>;
    }

    return links.length ? (
      <div className="public-profile-list">
        {links.map((link) => (
          <a key={link} href={link} target="_blank" rel="noreferrer">
            <LinkIcon size={18} />
            <span>{link}</span>
          </a>
        ))}
      </div>
    ) : <div className="public-profile-empty">Ссылок пока нет</div>;
  };

  return (
    <>
      <div className="modal active public-profile-backdrop" onClick={onClose}>
        <div className="modal-content public-profile-panel" onClick={(event) => event.stopPropagation()}>
          <header className="public-profile-topbar">
            <button type="button" className="public-profile-close" onClick={onClose} aria-label="Закрыть">
              <X size={20} />
            </button>
            <strong>Инфо</strong>
            <span />
          </header>

          <section className="public-profile-hero">
            <button
              type="button"
              className="public-profile-avatar"
              style={{ backgroundColor: profileItem.avatarColor, backgroundImage: avatarImage ? `url(${avatarImage})` : 'none' }}
              onClick={() => setShowAvatarLightbox(true)}
              aria-label="Открыть аватар"
            >
              {!avatarImage && avatarInitials}
            </button>
            <h2>{itemName}</h2>
            <p>
              {isUser
                ? isOnline ? 'в сети' : 'был недавно'
                : isChannel ? `${profileItem.members.length} подписчиков` : `${profileItem.members.length} участников`}
            </p>
            {isUser && profileItem.activityStatus && <small>{profileItem.activityStatus}</small>}
          </section>

          {isUser && (
            <section className="public-profile-actions">
              <button type="button" onClick={() => { onOpenChat?.(profileItem.id); onClose(); }}>
                <MessageCircle size={20} />
                <span>Чат</span>
              </button>
              <button type="button" onClick={() => { onStartCall?.(profileItem, 'audio'); onClose(); }}>
                <Phone size={20} />
                <span>Звонок</span>
              </button>
              <button type="button" onClick={() => { onStartCall?.(profileItem, 'video'); onClose(); }}>
                <Video size={20} />
                <span>Видео</span>
              </button>
              <button type="button" className={soundMuted ? 'active' : ''} onClick={toggleSound}>
                {soundMuted ? <BellOff size={20} /> : <Volume2 size={20} />}
                <span>{soundMuted ? 'Тихо' : 'Звук'}</span>
              </button>
              <button type="button" onClick={() => setShowMore((value) => !value)}>
                <MoreHorizontal size={20} />
                <span>Ещё</span>
              </button>
            </section>
          )}

          {isUser && (
            <section className="public-profile-details-card">
              {[
                ['О себе', profileItem.bio || profileItem.activityStatus || 'Пока ничего не указано', null],
                ['Телефон', profileItem.phoneNumber || 'Не указан', profileItem.phoneNumber],
                ['Почта', profileItem.email || 'Не указана', profileItem.email],
                ['NEXA ID', profileItem.nexaId || 'Не указан', profileItem.nexaId],
              ].map(([label, value, copyValue]) => (
                <div className="public-profile-detail-row" key={label || ''}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  {copyValue && (
                    <button type="button" onClick={() => copyText(label || 'value', copyValue)}>
                      <Copy size={16} />
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}

          {showMore && isUser && (
            <section className="public-profile-more">
              <button type="button" onClick={() => copyText('username', `@${profileItem.nickname}`)}>
                <Copy size={16} />
                {copied === 'username' ? 'Скопировано' : 'Скопировать username'}
              </button>
            </section>
          )}

          {isUser ? (
            <section className="public-profile-tabs-card">
              <div className="public-profile-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={activeTab === tab.key ? 'active' : ''}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                    {tab.count > 0 && <small>{tab.count}</small>}
                  </button>
                ))}
              </div>
              <div className="public-profile-tab-content">{renderTabContent()}</div>
            </section>
          ) : (
            <section className="public-profile-members-card">
              <div className="public-profile-members-heading">
                <span>{isChannel ? 'Подписчики и управление' : 'Участники'}</span>
                {addableUsers.length > 0 && (
                  <button type="button" onClick={() => setShowAddList((value) => !value)}>
                    <UserPlus size={15} />
                    Добавить
                  </button>
                )}
              </div>

              {showAddList && (
                <div className="public-profile-add-list">
                  {addableUsers.map((user) => (
                    <button key={user.id} type="button" onClick={() => handleAddMember(user.id)}>
                      <span className="public-profile-mini-avatar" style={{ backgroundColor: user.avatarColor }}>
                        {user.initials || getInitials(user.nickname)}
                      </span>
                      {user.nickname}
                    </button>
                  ))}
                </div>
              )}

              <div className="public-profile-members-list">
                {(profileItem.members || []).map((member) => {
                  const isCreator = ('creatorId' in profileItem && profileItem.creatorId === member.userId) || ('ownerId' in profileItem && profileItem.ownerId === member.userId);
                  const isAdmin = member.role === 'admin';
                  const isCurrentUserCreator = ('creatorId' in profileItem && profileItem.creatorId === currentUser?.id) || ('ownerId' in profileItem && profileItem.ownerId === currentUser?.id);
                  const canManage = isChannel && isCurrentUserCreator && !isCreator;

                  return (
                    <div key={member.userId} className="public-profile-member-row">
                      <span className="public-profile-mini-avatar" style={{ backgroundColor: member.user.avatarColor, backgroundImage: member.user.avatarImage ? `url(${mediaUrl(member.user.avatarImage)})` : 'none' }}>
                        {!member.user.avatarImage && (member.user.initials || getInitials(member.user.nickname))}
                      </span>
                      <div>
                        <strong>{member.user.nickname}</strong>
                        <small>{isCreator ? 'Владелец' : isAdmin ? 'Администратор' : 'Участник'}</small>
                      </div>
                      {canManage && (
                        <button type="button" onClick={() => toggleCoOwner(member.userId)}>
                          <Shield size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {canDelete && (
                <button type="button" className="public-profile-danger" onClick={handleDeleteChat}>
                  <Trash2 size={16} />
                  Удалить {isChannel ? 'канал' : 'группу'}
                </button>
              )}
            </section>
          )}
        </div>
      </div>

      {showAvatarLightbox && (
        <div className="avatar-lightbox" onClick={() => setShowAvatarLightbox(false)} role="dialog" aria-modal="true">
          <button
            type="button"
            className="avatar-lightbox-close"
            onClick={(event) => {
              event.stopPropagation();
              setShowAvatarLightbox(false);
            }}
            aria-label="Закрыть"
            title="Закрыть"
          >
            <X size={22} />
          </button>
          <div
            className="avatar-lightbox-image"
            onClick={(event) => event.stopPropagation()}
            style={{ backgroundColor: profileItem.avatarColor, backgroundImage: avatarImage ? `url(${avatarImage})` : 'none' }}
          >
            {!avatarImage && avatarInitials}
          </div>
        </div>
      )}
    </>
  );
};
