import React, { useMemo, useRef, useState } from 'react';
import { Calendar, Check, Copy, Edit3, Info, LogOut, Phone, Upload, User as UserIcon, X } from 'lucide-react';
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
  onUpdate: (data: Partial<User>) => void;
  handleLogout: () => void;
}

const normalizePhoneInput = (value: string) => value.replace(/[^\d+()\-\s]/g, '').slice(0, 32);

const roleLabel = (role?: User['role']) => {
  if (role === 'owner') return 'Владелец';
  if (role === 'admin') return 'Администратор';
  return 'Пользователь';
};

const parseOwnedAvatars = (value?: string) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

export const MyProfileModal: React.FC<MyProfileModalProps> = ({ onClose, user, onUpdate, handleLogout }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [copiedId, setCopiedId] = useState(false);
  const [archiveStories, setArchiveStories] = useState<any[] | null>(null);

  const ownedAvatars = useMemo(() => parseOwnedAvatars(user.ownedAvatars), [user.ownedAvatars]);
  const displayName = [firstName, lastName].filter(Boolean).join(' ') || `@${user.nickname}`;
  const previewAvatarImage = isEditing ? avatarImage : user.avatarImage;
  const previewAvatarColor = isEditing ? avatarColor : user.avatarColor;

  const fetchArchive = async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/stories/archive'), {
        headers: { Authorization: `Bearer ${localStorage.getItem('nexa_token')}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setArchiveStories(data);
      } else {
        notifyApp('Архив пуст', 'warning');
      }
    } catch (error) {
      console.error('Failed to load story archive:', error);
      notifyApp('Не удалось загрузить архив', 'error');
    }
  };

  const handleCopyId = async () => {
    if (!user.nexaId) return;
    await navigator.clipboard.writeText(user.nexaId);
    setCopiedId(true);
    window.setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setAvatarImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const nextNickname = nickname.trim() || user.nickname;
    onUpdate({
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      dateOfBirth: dateOfBirth || null,
      activityStatus: activityStatus.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
      bio: bio.trim(),
      nickname: nextNickname,
      avatarColor,
      avatarImage,
    });
    setIsEditing(false);
  };

  const cancelEditing = () => {
    setFirstName(user.firstName || '');
    setLastName(user.lastName || '');
    setDateOfBirth(user.dateOfBirth || '');
    setActivityStatus(user.activityStatus || '');
    setPhoneNumber(user.phoneNumber || '');
    setBio(user.bio || '');
    setNickname(user.nickname || '');
    setAvatarColor(user.avatarColor);
    setAvatarImage(user.avatarImage || null);
    setIsEditing(false);
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content profile-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="profile-modal-header">
          <button className="close-modal profile-close-button" onClick={onClose} title="Закрыть">
            <X size={18} />
          </button>

          <div className="profile-modal-identity">
            <button
              type="button"
              className="avatar-large profile-avatar-button"
              onClick={() => isEditing && fileInputRef.current?.click()}
              style={{
                backgroundColor: previewAvatarColor,
                backgroundImage: previewAvatarImage ? `url(${previewAvatarImage})` : 'none',
              }}
              title={isEditing ? 'Изменить аватар' : undefined}
            >
              {!previewAvatarImage && getInitials(nickname || user.nickname)}
              {isEditing && (
                <span className="avatar-edit-overlay profile-avatar-overlay">
                  <Upload size={16} />
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept="image/*"
              onChange={handleAvatarFileChange}
            />

            <div className="profile-modal-title">
              <h3>{displayName}</h3>
              <p>@{user.nickname}</p>
              <span className={`profile-role-badge profile-role-${user.role || 'user'}`}>
                {roleLabel(user.role)}
              </span>
            </div>
          </div>
        </div>

        <div className="settings-body profile-modal-body">
          {isEditing ? (
            <div className="profile-edit-form">
              <label>
                <span>Никнейм</span>
                <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ваш никнейм" />
              </label>

              <div className="profile-form-grid">
                <label>
                  <span>Имя</span>
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Ваше имя" />
                </label>
                <label>
                  <span>Фамилия</span>
                  <input value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Ваша фамилия" />
                </label>
              </div>

              <label>
                <span>Статус</span>
                <input value={activityStatus} onChange={(event) => setActivityStatus(event.target.value)} placeholder="Например: на связи" />
              </label>

              <label>
                <span>Дата рождения</span>
                <input type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
              </label>

              <label>
                <span>Телефон</span>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(normalizePhoneInput(event.target.value))}
                  placeholder="+7 900 000-00-00"
                />
              </label>

              <label>
                <span>О себе</span>
                <textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Расскажите немного о себе" rows={3} />
              </label>

              <div>
                <span className="profile-field-label">Цвет профиля</span>
                <div className="color-options profile-color-options">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`color-opt ${avatarColor === color ? 'active' : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setAvatarColor(color)}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              {ownedAvatars.length > 0 && (
                <div>
                  <span className="profile-field-label">Купленные аватары</span>
                  <div className="profile-owned-avatars">
                    <button type="button" onClick={() => setAvatarImage(null)} className={avatarImage === null ? 'active' : ''}>
                      Сброс
                    </button>
                    {ownedAvatars.map((url) => (
                      <button
                        type="button"
                        key={url}
                        onClick={() => setAvatarImage(url)}
                        className={avatarImage === url ? 'active' : ''}
                        style={{ backgroundImage: `url(${url})` }}
                        title="Выбрать аватар"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="profile-edit-actions">
                <button type="button" className="btn-secondary" onClick={cancelEditing}>Отмена</button>
                <button type="button" className="btn-primary" onClick={handleSave}>
                  <Check size={16} /> Сохранить
                </button>
              </div>
            </div>
          ) : (
            <div className="profile-info-list">
              <div className="profile-info-row">
                <UserIcon size={20} />
                <div>
                  <span>NEXA ID</span>
                  <strong>{user.nexaId || 'Не назначен'}</strong>
                </div>
                {user.nexaId && (
                  <button type="button" onClick={handleCopyId}>
                    {copiedId ? 'Скопировано' : <><Copy size={14} /> Копировать</>}
                  </button>
                )}
              </div>

              <div className="profile-info-row">
                <Phone size={20} />
                <div>
                  <span>Телефон</span>
                  <strong>{user.phoneNumber || 'Не указан'}</strong>
                </div>
              </div>

              <div className="profile-info-row">
                <Calendar size={20} />
                <div>
                  <span>Дата рождения</span>
                  <strong>{user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString('ru-RU') : 'Не указана'}</strong>
                </div>
              </div>

              {user.activityStatus && (
                <div className="profile-info-row">
                  <Info size={20} />
                  <div>
                    <span>Статус</span>
                    <strong>{user.activityStatus}</strong>
                  </div>
                </div>
              )}

              <div className="profile-info-row">
                <Info size={20} />
                <div>
                  <span>О себе</span>
                  <strong>{user.bio || 'Пока ничего не добавлено'}</strong>
                </div>
              </div>

              <div className="profile-wallet-card">
                <div>
                  <span>Кошелек</span>
                  <strong>{user.balance?.toLocaleString('ru-RU') || 0} NEXA</strong>
                </div>
                <button type="button" onClick={() => setShowMarket(true)}>Маркет</button>
              </div>

              {user.role === 'admin' && (
                <button type="button" className="profile-admin-wallet-button" onClick={() => socket.emit('wallet:grant', { amount: 5000 })}>
                  Выдать себе 5000 NEXA
                </button>
              )}

              <button type="button" className="profile-archive-button" onClick={fetchArchive}>Архив историй</button>

              <div className="profile-footer-status">
                <span>Статус: {socket.connected ? 'в сети' : 'не в сети'}</span>
              </div>

              <div className="profile-bottom-actions">
                <button type="button" onClick={() => setIsEditing(true)}>
                  <Edit3 size={15} /> Изменить
                </button>
                <button type="button" className="danger" onClick={handleLogout}>
                  <LogOut size={15} /> Выйти
                </button>
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
