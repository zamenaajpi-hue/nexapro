import React, { useState } from 'react';
import { X, UserPlus, ShieldAlert, Shield, Trash2 } from 'lucide-react';
import { User, Group, Channel } from '../../types/chat';
import { getInitials } from '../../utils/helpers';

interface ProfileModalProps {
  onClose: () => void;
  profileItem: User | Group | Channel;
  onlineUsers?: User[];
  socket?: any;
  currentUser?: User;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onClose, profileItem, onlineUsers = [], socket, currentUser }) => {
  const [showAddList, setShowAddList] = useState(false);
  
  const isChannel = ('isChannel' in profileItem && profileItem.isChannel) || ('isGroup' in profileItem && profileItem.name.includes('📢'));
  const isGroupOrChannel = 'isGroup' in profileItem || ('isChannel' in profileItem && profileItem.isChannel);

  const [coOwners, setCoOwners] = useState<string[]>(() => {
    if (isGroupOrChannel) {
      const saved = localStorage.getItem(`nexa_channel_coowners_${profileItem.id}`);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const groupMemberIds = isGroupOrChannel && 'members' in profileItem ? (profileItem.members || []).map(m => m.userId) : [];
  const addableUsers = onlineUsers.filter(u => !groupMemberIds.includes(u.id));

  const handleAddMember = (userId: string) => {
    if (socket && isGroupOrChannel) {
      if ('isChannel' in profileItem && profileItem.isChannel) {
        socket.emit('channel:add-member', { channelId: profileItem.id, userId });
      } else {
        socket.emit('group:add-member', { groupId: profileItem.id, userId });
      }
      setShowAddList(false);
    }
  };

  const toggleCoOwner = (userId: string) => {
    const isOwner = ('creatorId' in profileItem && profileItem.creatorId === currentUser?.id) || ('ownerId' in profileItem && profileItem.ownerId === currentUser?.id);
    if (isGroupOrChannel && isOwner) {
      const updated = coOwners.includes(userId)
        ? coOwners.filter(id => id !== userId)
        : [...coOwners, userId];
      setCoOwners(updated);
      localStorage.setItem(`nexa_channel_coowners_${profileItem.id}`, JSON.stringify(updated));
    }
  };

  const canDelete = isGroupOrChannel && currentUser && (
    ('creatorId' in profileItem && profileItem.creatorId === currentUser.id) ||
    ('ownerId' in profileItem && profileItem.ownerId === currentUser.id)
  );

  const handleDeleteChat = () => {
    if (!socket || !canDelete) return;
    const label = isChannel ? 'канал' : 'группу';
    if (!confirm(`Удалить ${label}? Это действие удалит чат и все связанные сообщения.`)) return;
    if (isChannel) {
      socket.emit('channel:delete', { channelId: profileItem.id });
    } else {
      socket.emit('group:delete', { groupId: profileItem.id });
    }
    onClose();
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '0', overflowY: 'auto', borderRadius: '16px', maxHeight: '90vh' }}>
        <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
            {isChannel ? 'Информация о канале' : 'name' in profileItem ? 'Информация о группе' : 'Профиль пользователя'}
          </h3>
          <button className="close-modal" onClick={onClose} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
        </header>
        
        <div className="settings-body" style={{ padding: '24px' }}>
          <div className="profile-preview-large" style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            <div 
              className="avatar-large" 
              style={{ 
                backgroundColor: profileItem.avatarColor,
                backgroundImage: profileItem.avatarImage ? `url(${profileItem.avatarImage})` : 'none',
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: 'white',
                border: '3px solid var(--accent-color)',
                boxShadow: '0 8px 16px rgba(0, 239, 255, 0.15)'
              }}
            >
              {!profileItem.avatarImage && (('initials' in profileItem ? profileItem.initials : null) || getInitials('name' in profileItem ? profileItem.name : (profileItem as any).nickname))}
            </div>
          </div>
          
          <div className="profile-info-center" style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {'name' in profileItem ? profileItem.name : (profileItem as any).nickname}
            </h2>
            {!('name' in profileItem) && (profileItem as User).nexaId && (
              <p style={{ color: 'var(--accent-color)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.5px', margin: '4px 0' }}>
                ID: {(profileItem as User).nexaId}
              </p>
            )}
            {!('name' in profileItem) && (profileItem as User).activityStatus && (
              <p style={{ margin: '8px 0 0', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                {(profileItem as User).activityStatus}
              </p>
            )}
            <p className="profile-subtext" style={{ margin: '8px 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {isChannel 
                ? `${profileItem.members.length} подписчиков` 
                : 'name' in profileItem 
                  ? `${profileItem.members.length} участников` 
                  : 'Личный профиль Nexa'}
            </p>
            {!('name' in profileItem) && (profileItem as User).bio && (
              <p className="profile-bio" style={{ margin: '12px 0 0', fontStyle: 'italic', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {(profileItem as User).bio}
              </p>
            )}
          </div>

          {isGroupOrChannel && (
            <div className="member-list" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {isChannel ? 'ПОДПИСЧИКИ И УПРАВЛЕНИЕ' : 'УЧАСТНИКИ'}
                </label>
                {addableUsers.length > 0 && (
                  <button 
                    onClick={() => setShowAddList(!showAddList)}
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px', 
                      padding: '4px 8px', 
                      color: 'var(--accent-color)', 
                      fontSize: '0.75rem', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <UserPlus size={14} />
                    Добавить
                  </button>
                )}
              </div>

              {showAddList && addableUsers.length > 0 && (
                <div style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', marginBottom: '12px', maxHeight: '150px', overflowY: 'auto' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Выберите, кого добавить:</p>
                  {addableUsers.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => handleAddMember(u.id)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '6px', 
                        borderRadius: '6px', 
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        fontSize: '0.85rem'
                      }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="avatar" style={{ backgroundColor: u.avatarColor, width: 24, height: 24, fontSize: '8px' }}>{u.initials}</div>
                      <span>{u.nickname}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="selection-list" style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(profileItem.members || []).map(m => {
                  const isCreator = ('creatorId' in profileItem && profileItem.creatorId === m.userId) || ('ownerId' in profileItem && profileItem.ownerId === m.userId);
                  const isUserCoOwner = coOwners.includes(m.userId);
                  const isCurrentUserCreator = ('creatorId' in profileItem && profileItem.creatorId === currentUser?.id) || ('ownerId' in profileItem && profileItem.ownerId === currentUser?.id);
                  const canManage = isChannel && isCurrentUserCreator && !isCreator;

                  return (
                    <div 
                      key={m.userId} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: '10px 12px', 
                        borderRadius: '10px', 
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar" style={{ backgroundColor: m.user.avatarColor, width: 34, height: 34, fontSize: '10px' }}>{m.user.initials}</div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{m.user.nickname}</span>
                          {isChannel && (
                            <span style={{ fontSize: '0.7rem', color: isCreator ? 'var(--accent-color)' : isUserCoOwner ? '#c084fc' : 'var(--text-secondary)' }}>
                              {isCreator ? 'Создатель / Владелец' : isUserCoOwner ? 'Совладелец' : 'Подписчик'}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {canManage && (
                        <button
                          onClick={() => toggleCoOwner(m.userId)}
                          style={{
                            background: isUserCoOwner ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 242, 255, 0.08)',
                            border: '1px solid ' + (isUserCoOwner ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 242, 255, 0.3)'),
                            color: isUserCoOwner ? '#ef4444' : 'var(--accent-color)',
                            fontSize: '0.72rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => (e.currentTarget.style.background = isUserCoOwner ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 242, 255, 0.15)')}
                          onMouseOut={(e) => (e.currentTarget.style.background = isUserCoOwner ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 242, 255, 0.08)')}
                        >
                          {isUserCoOwner ? 'Разжаловать' : 'Сделать совладельцем'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {canDelete && (
                <div style={{ marginTop: '14px' }}>
                  <button
                    type="button"
                    onClick={handleDeleteChat}
                    style={{
                      width: '100%',
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      color: '#ef4444',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <Trash2 size={16} />
                    Удалить {isChannel ? 'канал' : 'группу'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
