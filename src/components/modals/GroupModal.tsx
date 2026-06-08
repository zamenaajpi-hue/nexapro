import React, { useState } from 'react';
import { X } from 'lucide-react';
import { User } from '../../types/chat';
import { generateGroupAvatar } from '../../utils/avatarGenerator';

interface GroupModalProps {
  onClose: () => void;
  onlineUsers: User[];
  handleCreateGroup: (name: string, members: string[]) => void;
}

export const GroupModal: React.FC<GroupModalProps> = ({ onClose, onlineUsers, handleCreateGroup }) => {
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const onSubmit = () => {
    if (!groupName.trim()) return;
    handleCreateGroup(groupName, selectedMembers);
  };

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <header>
          <h3>Создать новую группу</h3>
          <button className="close-modal" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="settings-body">
          <div className="setting-item">
            <label>Название группы и превью аватара</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px' }}>
              <div 
                className="avatar" 
                style={{ 
                  width: '64px', 
                  height: '64px', 
                  borderRadius: '16px',
                  backgroundImage: `url(${generateGroupAvatar(groupName || 'Group')})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  flexShrink: 0,
                  transition: 'background-image 0.2s ease'
                }} 
              />
              <input 
                type="text" 
                placeholder="Введите название группы..." 
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                style={{ flex: 1, margin: 0 }}
              />
            </div>
          </div>
          <div className="setting-item">
            <label>Выберите участников</label>
            <div className="selection-list">
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
                  <div className="avatar" style={{ backgroundColor: u.avatarColor, width: 32, height: 32, fontSize: '10px' }}>{u.initials}</div>
                  <span>{u.nickname}</span>
                </label>
              ))}
            </div>
          </div>
          <button className="btn-primary" onClick={onSubmit}>Создать группу</button>
        </div>
      </div>
    </div>
  );
};
