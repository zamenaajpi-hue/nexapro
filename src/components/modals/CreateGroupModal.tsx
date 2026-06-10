import React, { useState } from 'react';
import { Camera, Hash, Lock, X } from 'lucide-react';
import { User } from '../../types/chat';

interface CreateGroupModalProps {
  onClose: () => void;
  onlineUsers: User[];
  handleCreateGroup: (data: { name: string; description?: string; isPublic: boolean; members: string[] }) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onlineUsers, handleCreateGroup }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    handleCreateGroup({
      name: trimmedName,
      description: description.trim() || undefined,
      isPublic,
      members: selectedMembers,
    });
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '420px' }}>
        <header>
          <h3>{step === 1 ? 'Создание группы' : 'Добавить участников'}</h3>
          <button className="close-modal" onClick={onClose} title="Закрыть">
            <X size={20} />
          </button>
        </header>

        <div className="settings-body">
          {step === 1 ? (
            <>
              <div className="modal-avatar-name-row">
                <div className="modal-avatar-placeholder">
                  <Camera size={24} />
                </div>
                <input
                  type="text"
                  placeholder="Название группы"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <input
                type="text"
                placeholder="Описание (необязательно)"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />

              <div className="segmented-actions">
                <button type="button" className={!isPublic ? 'active' : ''} onClick={() => setIsPublic(false)}>
                  <Lock size={16} /> Приватная
                </button>
                <button type="button" className={isPublic ? 'active' : ''} onClick={() => setIsPublic(true)}>
                  <Hash size={16} /> Публичная
                </button>
              </div>

              <button className="btn-primary" onClick={() => setStep(2)} disabled={!name.trim()}>
                Далее
              </button>
            </>
          ) : (
            <>
              <div className="selection-list group-member-list">
                {onlineUsers.length === 0 && (
                  <div className="empty-selection">Пока нет пользователей для добавления</div>
                )}
                {onlineUsers.map((candidate) => (
                  <label key={candidate.id} className="selection-item">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(candidate.id)}
                      onChange={() => {
                        setSelectedMembers((current) =>
                          current.includes(candidate.id)
                            ? current.filter((id) => id !== candidate.id)
                            : [...current, candidate.id],
                        );
                      }}
                    />
                    <div
                      className="avatar"
                      style={{
                        backgroundColor: candidate.avatarColor || '#6C63FF',
                        backgroundImage: candidate.avatarImage ? `url(${candidate.avatarImage})` : 'none',
                        width: 32,
                        height: 32,
                        fontSize: '12px',
                        borderRadius: '50%',
                      }}
                    >
                      {!candidate.avatarImage && (candidate.initials || candidate.nickname?.[0])}
                    </div>
                    <span>{candidate.nickname}</span>
                  </label>
                ))}
              </div>
              <div className="modal-footer-grid">
                <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Назад</button>
                <button type="button" className="btn-primary" onClick={submit}>Создать группу</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
