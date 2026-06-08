import React, { useState } from 'react';
import { X, Camera, Lock, Hash } from 'lucide-react';

interface CreateChannelModalProps {
  onClose: () => void;
  handleCreateChannel: (data: any) => void;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({ onClose, handleCreateChannel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const onSubmit = () => {
    if (!name.trim()) return;
    handleCreateChannel({
      name,
      description,
      isPublic,
    });
  };

  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <header>
          <h3>Создание канала</h3>
          <button className="close-modal" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="settings-body">
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
              <Camera size={24} />
            </div>
            <input 
              type="text" 
              placeholder="Название канала" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>

          <div className="setting-item" style={{ marginTop: '16px' }}>
            <input 
              type="text" 
              placeholder="Описание (необязательно)" 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="setting-item" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              onClick={() => setIsPublic(false)}
              style={{ flex: 1, padding: '12px', background: !isPublic ? 'var(--accent-color)' : 'var(--bg-secondary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Lock size={16} /> Приватный
            </button>
            <button 
              onClick={() => setIsPublic(true)}
              style={{ flex: 1, padding: '12px', background: isPublic ? 'var(--accent-color)' : 'var(--bg-secondary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Hash size={16} /> Публичный
            </button>
          </div>

          <button className="btn-primary" onClick={onSubmit} disabled={!name.trim()} style={{ marginTop: '24px' }}>Создать канал</button>
        </div>
      </div>
    </div>
  );
};
