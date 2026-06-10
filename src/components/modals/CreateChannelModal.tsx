import React, { useState } from 'react';
import { Camera, Hash, Lock, X } from 'lucide-react';

interface CreateChannelModalProps {
  onClose: () => void;
  handleCreateChannel: (data: { name: string; description?: string; isPublic: boolean }) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ onClose, handleCreateChannel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const submit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    handleCreateChannel({
      name: trimmedName,
      description: description.trim() || undefined,
      isPublic,
    });
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '420px' }}>
        <header>
          <h3>Создание канала</h3>
          <button className="close-modal" onClick={onClose} title="Закрыть">
            <X size={20} />
          </button>
        </header>

        <div className="settings-body">
          <div className="modal-avatar-name-row">
            <div className="modal-avatar-placeholder">
              <Camera size={24} />
            </div>
            <input
              type="text"
              placeholder="Название канала"
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
              <Lock size={16} /> Приватный
            </button>
            <button type="button" className={isPublic ? 'active' : ''} onClick={() => setIsPublic(true)}>
              <Hash size={16} /> Публичный
            </button>
          </div>

          <button className="btn-primary" onClick={submit} disabled={!name.trim()}>
            Создать канал
          </button>
        </div>
      </div>
    </div>
  );
};
