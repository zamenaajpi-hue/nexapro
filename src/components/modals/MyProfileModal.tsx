import React, { useState } from 'react';
import { X, Calendar, User as UserIcon, Edit3, Check, Copy, Info, LogOut, Shield, Phone } from 'lucide-react';
import { User } from '../../types/chat';
import { getInitials } from '../../utils/helpers';
import { COLORS } from '../../shared/constants';
import { socket } from '../../socket/client';
import { notifyApp } from '../../utils/notifications';
import { resolveApiUrl } from '../../utils/api';

import { MarketplaceModal } from './MarketplaceModal';
import { StoryViewer } from '../stories/StoryViewer';

interface MyProfileModalProps {
  onClose: () => void;
  user: User;
  onUpdate: (data: any) => void;
  handleLogout: () => void;
}

export const MyProfileModal: React.FC<MyProfileModalProps> = ({ onClose, user, onUpdate, handleLogout }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showMarket, setShowMarket] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [dateOfBirth, setDateOfBirth] = useState(user.dateOfBirth || '');
  const [activityStatus, setActivityStatus] = useState(user.activityStatus || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [bio, setBio] = useState(user.bio || '');
  const [nickname, setNickname] = useState(user.nickname || '');
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [avatarImage, setAvatarImage] = useState<string | null>(user.avatarImage || null);
  const [role, setRole] = useState<'user' | 'admin' | 'owner'>(user.role || 'user');
  const [copiedId, setCopiedId] = useState(false);
  
  const [archiveStories, setArchiveStories] = useState<any[] | null>(null);

  const fetchArchive = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/stories/archive'), { headers: { 'Authorization': `Bearer ${localStorage.getItem('nexa_token')}` }});
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setArchiveStories(data);
        } else {
          notifyApp('Архив пуст', 'warning');
        }
      }
    } catch(e) { console.error(e); }
  };

  const ownedAvatars = JSON.parse(user.ownedAvatars || '[]');

  const handleCopyId = () => {
    if (user.nexaId) {
      navigator.clipboard.writeText(user.nexaId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    onUpdate({
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      dateOfBirth: dateOfBirth.trim() || null,
      activityStatus: activityStatus.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
      bio: bio.trim(),
      nickname: nickname.trim() || user.nickname,
      avatarColor,
      avatarImage,
      role
    });
    setIsEditing(false);
  };

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || `@${user.nickname}`;

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', padding: '0', overflowY: 'auto', borderRadius: '16px', maxHeight: '90vh' }}>
        {/* Profile Card Header with custom slick background */}
        <div style={{ background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(3, 7, 18, 0.95))', padding: '28px 24px', borderBottom: '1px solid var(--border-color)', position: 'relative' }}>
          <button 
            className="close-modal" 
            onClick={onClose} 
            style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', padding: '6px', borderRadius: '50%', cursor: 'pointer', transition: 'all 0.2s', display: 'flex' }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <X size={18} />
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div 
              className="avatar-large" 
              style={{ 
                backgroundColor: isEditing ? avatarColor : user.avatarColor,
                backgroundImage: isEditing 
                  ? (avatarImage ? `url(${avatarImage})` : 'none')
                  : (user.avatarImage ? `url(${user.avatarImage})` : 'none'),
                width: '76px',
                height: '76px',
                fontSize: '24px',
                border: '3px solid var(--accent-color)',
                boxShadow: '0 8px 16px rgba(0, 239, 255, 0.15)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: 'white',
                position: 'relative',
                cursor: isEditing ? 'pointer' : 'default'
              }}
              onClick={() => isEditing && document.getElementById('avatar-upload-input')?.click()}
            >
              {isEditing 
                ? (!avatarImage && getInitials(nickname || user.nickname))
                : (!user.avatarImage && (user.initials || getInitials(user.nickname)))
              }
              {isEditing && (
                <div className="avatar-edit-overlay" style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: 600,
                  opacity: 1,
                  transition: 'opacity 0.2s'
                }}>
                  Изменить
                </div>
              )}
            </div>
            <input 
              type="file" 
              id="avatar-upload-input" 
              style={{ display: 'none' }} 
              accept="image/*"
              onChange={handleAvatarFileChange} 
            />

            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px', lineHeight: '1.3' }}>
                {displayName}
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                @{user.nickname}
              </p>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', marginTop: '6px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, color: (isEditing ? role : user.role) === 'admin' ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                  {(isEditing ? role : user.role) === 'admin' ? 'Владелец / Администратор' : 'Пользователь'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body / Profile fields */}
        <div className="settings-body" style={{ padding: '24px', background: 'rgba(3, 7, 18, 0.2)' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="setting-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Имя пользователя (Никнейм)</label>
                <input 
                  type="text" 
                  value={nickname} 
                  onChange={e => setNickname(e.target.value)} 
                  placeholder="Ваш никнейм" 
                  style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'white', width: '100%' }}
                />
              </div>

              <div className="setting-item" style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Имя</label>
                  <input 
                    type="text" 
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    placeholder="Ваше имя" 
                    style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'white', width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Фамилия</label>
                  <input 
                    type="text" 
                    value={lastName} 
                    onChange={e => setLastName(e.target.value)} 
                    placeholder="Ваша фамилия" 
                    style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'white', width: '100%' }}
                  />
                </div>
              </div>

              <div className="setting-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Текущий статус (Деятельность)</label>
                <input 
                  type="text" 
                  value={activityStatus} 
                  onChange={e => setActivityStatus(e.target.value)} 
                  placeholder="Например: 💻 Кодит" 
                  style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'white', width: '100%', outline: 'none' }}
                />
              </div>

              <div className="setting-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Дата рождения</label>
                <input 
                  type="date" 
                  value={dateOfBirth} 
                  onChange={e => setDateOfBirth(e.target.value)} 
                  style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'white', width: '100%', outline: 'none' }}
                />
              </div>

              <div className="setting-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Цвет профиля</label>
                <div className="color-options" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {COLORS.map(color => (
                    <div 
                      key={color}
                      className={`color-opt ${avatarColor === color ? 'active' : ''}`} 
                      style={{ 
                        backgroundColor: color, 
                        width: '28px', 
                        height: '28px', 
                        borderRadius: '50%', 
                        cursor: 'pointer',
                        border: avatarColor === color ? '2px solid white' : 'none',
                        boxShadow: avatarColor === color ? '0 0 8px var(--accent-color)' : 'none'
                      }}
                      onClick={() => setAvatarColor(color)}
                    />
                  ))}
                </div>
              </div>

              <div className="setting-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>РўРµР»РµС„РѕРЅ</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="+7 900 000-00-00"
                  style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'white', width: '100%', outline: 'none' }}
                />
              </div>

              {ownedAvatars.length > 0 && (
                <div className="setting-item">
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Ваши фирменные аватарки</label>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
                    <div 
                      onClick={() => setAvatarImage(null)}
                      style={{ 
                        width: '40px', 
                        height: '40px', 
                        borderRadius: '8px', 
                        border: avatarImage === null ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '10px',
                        background: 'rgba(255,255,255,0.05)'
                      }}
                    >
                      Сброс
                    </div>
                    {ownedAvatars.map((url: string, idx: number) => (
                      <div 
                        key={idx}
                        onClick={() => setAvatarImage(url)}
                        style={{ 
                          width: '40px', 
                          height: '40px', 
                          borderRadius: '8px', 
                          backgroundImage: `url(${url})`,
                          backgroundSize: 'cover',
                          border: avatarImage === url ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="setting-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>О себе</label>
                <textarea 
                  value={bio} 
                  onChange={e => setBio(e.target.value)} 
                  placeholder="Расскажите немного о себе..." 
                  rows={3} 
                  style={{ background: 'var(--message-in)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', color: 'white', width: '100%', resize: 'none' }}
                />
              </div>

              <div className="setting-item">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Системная роль</label>
                <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ 
                    padding: '4px 10px', 
                    borderRadius: '8px', 
                    fontSize: '11px', 
                    fontWeight: 700, 
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    backgroundColor: role === 'admin' ? 'rgba(0, 242, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                    color: role === 'admin' ? '#00efff' : 'var(--text-secondary)',
                    border: role === 'admin' ? '1px solid rgba(0, 242, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    {role === 'admin' ? 'Администратор' : 'Пользователь'}
                  </span>
                  <button 
                    type="button"
                    className="btn-primary" 
                    style={{ padding: '6px 14px', fontSize: '11px', minWidth: 'auto', width: 'auto', margin: 0 }}
                    onClick={() => setRole(role === 'admin' ? 'user' : 'admin')}
                  >
                    Сделать {role === 'admin' ? 'Пользователем' : 'Администратором'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                <button 
                  onClick={() => setIsEditing(false)} 
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                  onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                  Отмена
                </button>
                <button 
                  onClick={handleSave} 
                  style={{ background: 'var(--accent-color)', color: '#030303', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Check size={16} /> Сохранить
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Nexa ID row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ background: 'rgba(0, 239, 255, 0.08)', padding: '8px', borderRadius: '10px', color: 'var(--accent-color)' }}>
                  <UserIcon size={20} />
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>NEXA ID</h4>
                    <p className="font-mono" style={{ margin: '2px 0 0', fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600 }}>{user.nexaId || 'Не назначен'}</p>
                  </div>
                  {user.nexaId && (
                    <button 
                      onClick={handleCopyId}
                      style={{ background: copiedId ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', color: copiedId ? '#10b981' : 'var(--text-secondary)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s' }}
                    >
                      {copiedId ? 'Скопирован!' : <><Copy size={12} /> Копировать</>}
                    </button>
                  )}
                </div>
              </div>

              {/* Phone row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ background: 'rgba(14, 165, 233, 0.08)', padding: '8px', borderRadius: '10px', color: '#38bdf8' }}>
                  <Phone size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>РўР•Р›Р•Р¤РћРќ</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {user.phoneNumber || 'РќРµ СѓРєР°Р·Р°РЅ'}
                  </p>
                </div>
              </div>

              {/* Date of Birth row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ background: 'rgba(124, 58, 237, 0.08)', padding: '8px', borderRadius: '10px', color: '#c084fc' }}>
                  <Calendar size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>ДАТА РОЖДЕНИЯ</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Не указана'}
                  </p>
                </div>
              </div>

              {/* Activity Status row */}
              {user.activityStatus && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                  <div style={{ background: 'rgba(52, 211, 153, 0.08)', padding: '8px', borderRadius: '10px', color: '#10b981' }}>
                    <div style={{ fontSize: '20px' }}>{user.activityStatus.split(' ')[0] || '🎮'}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>АКТИВНОСТЬ</h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {user.activityStatus}
                    </p>
                  </div>
                </div>
              )}

              {/* Bio row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '8px', borderRadius: '10px', color: '#f59e0b' }}>
                  <Info size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>О СЕБЕ</h4>
                  <p style={{ margin: '2px 0 0', fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {user.bio || 'Рассказ о себе не заполнен.'}
                  </p>
                </div>
              </div>

              {/* Wallet Section */}
              <div style={{ background: 'rgba(0, 239, 255, 0.04)', borderRadius: '14px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ padding: '6px', borderRadius: '8px', background: 'var(--accent-color)', color: '#000' }}>
                      <Check size={18} /> 
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>МОЙ КОШЕЛЕК</h4>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{user.balance?.toLocaleString()} <span style={{ color: 'var(--accent-color)' }}>NEXA</span></div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowMarket(true)}
                    style={{ background: 'var(--accent-color)', color: '#000', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    МАРКЕТ
                  </button>
                </div>

                {user.role === 'admin' && (
                  <button 
                    onClick={() => socket.emit('wallet:grant', { amount: 5000 })}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'var(--accent-color)', border: '1px solid var(--border-color)', padding: '8px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ВЫДАТЬ СЕБЕ 5000 NEXA
                  </button>
                )}
              </div>

              {/* Status and Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button 
                  onClick={fetchArchive}
                  style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s', fontSize: '0.85rem' }}
                >
                  Архив Историй
                </button>
                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    Статус: {socket.connected ? 'В сети ' : 'Вне сети'} {socket.connected ? '🟢' : '🔴'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button 
                    onClick={() => setIsEditing(true)} 
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', color: 'var(--accent-color)', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s', fontSize: '0.85rem' }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'rgba(0, 239, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(0, 239, 255, 0.3)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }}
                  >
                    <Edit3 size={15} /> Изменить
                  </button>

                  <button 
                    onClick={handleLogout} 
                    style={{ background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'all 0.2s', fontSize: '0.85rem' }}
                    onMouseOver={e => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.04)';
                    }}
                  >
                    <LogOut size={15} /> Выйти
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {showMarket && <MarketplaceModal user={user} onClose={() => setShowMarket(false)} />}
      {archiveStories && <StoryViewer stories={archiveStories} onClose={() => setArchiveStories(null)} onUpdate={() => {}} />}
    </div>
  );
};
