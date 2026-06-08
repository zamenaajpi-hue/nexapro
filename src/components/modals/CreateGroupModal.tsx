import React, { useState } from 'react';
import { X, Camera, Lock, Hash } from 'lucide-react';
import { User } from '../../types/chat';

interface CreateGroupModalProps {
  onClose: () => void;
  onlineUsers: User[];
  handleCreateGroup: (data: any) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose, onlineUsers, handleCreateGroup }) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleNext = () => {
    if (!name.trim()) return;
    setStep(2);
  };

  const onSubmit = () => {
    handleCreateGroup({
      name,
      description,
      isPublic,
      members: selectedMembers,
    });
  };

  return (
    <div className="modal active" onClick={onClose} style={{ zIndex: 100 }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
        <header>
          <h3>{step === 1 ? 'Создание группы' : 'Добавить участников'}</h3>
          <button className="close-modal" onClick={onClose}><X size={20} /></button>
        </header>

        <div className="settings-body">
          {step === 1 && (
            <>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                  <Camera size={24} />
                </div>
                <input 
                  type="text" 
                  placeholder="Название группы" 
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
                  <Lock size={16} /> Приватная
                </button>
                <button 
                  onClick={() => setIsPublic(true)}
                  style={{ flex: 1, padding: '12px', background: isPublic ? 'var(--accent-color)' : 'var(--bg-secondary)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Hash size={16} /> Публичная
                </button>
              </div>

              <button className="btn-primary" onClick={handleNext} disabled={!name.trim()} style={{ marginTop: '24px' }}>Далее</button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="selection-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {onlineUsers.map(u => (
                  <label key={u.id} className="selection-item">
                    <input 
                      type="checkbox" 
                      checked={selectedMembers.includes(u.id)}
                      onChange={() => {
                        setSelectedMembers(prev => 
                          prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]
                        );
                      }}
                    />
                    <div className="avatar" style={{ backgroundColor: u.avatarColor || '#ccc', width: 32, height: 32, fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', borderRadius: '50%' }}>
                      {u.avatarImage ? <img src={u.avatarImage} alt="" style={{width: '100%', height:'100%', borderRadius:'50%'}} /> : (u.initials || u.nickname?.[0])}
                    </div>
                    <span>{u.nickname}</span>
                  </label>
                ))}
              </div>
              <button className="btn-primary" onClick={onSubmit} style={{ marginTop: '24px' }}>Создать группу</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
