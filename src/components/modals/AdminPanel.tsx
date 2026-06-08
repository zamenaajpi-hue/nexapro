import React from 'react';
import { Shield, X, Trash2 } from 'lucide-react';
import { User } from '../../types/chat';
import { getInitials } from '../../utils/helpers';

interface AdminPanelProps {
  onClose: () => void;
  adminTab: 'stats' | 'users' | 'groups' | 'messages';
  setAdminTab: (tab: 'stats' | 'users' | 'groups' | 'messages') => void;
  adminStats: any;
  adminUsers: User[];
  adminGroups: any[];
  adminMessages: any[];
  currentUser: User;
  handleToggleUserRole: (id: string, role: string) => void;
  handleDeleteUser: (id: string) => void;
  handleDeleteGroup: (id: string) => void;
  handleDeleteMessage: (id: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onClose,
  adminTab,
  setAdminTab,
  adminStats,
  adminUsers,
  adminGroups,
  adminMessages,
  currentUser,
  handleToggleUserRole,
  handleDeleteUser,
  handleDeleteGroup,
  handleDeleteMessage
}) => {
  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '850px', width: '90%' }}>
        <header>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={22} style={{ color: 'var(--accent-color)' }} />
            <h3 style={{ margin: 0 }}>Администрирование системы Nexa</h3>
          </div>
          <button className="close-modal" onClick={onClose}><X size={20} /></button>
        </header>

        {/* Admin Tabs */}
        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          <button className={`tab-btn ${adminTab === 'stats' ? 'active' : ''}`} onClick={() => setAdminTab('stats')}>
            Статистика и Среда
          </button>
          <button className={`tab-btn ${adminTab === 'users' ? 'active' : ''}`} onClick={() => setAdminTab('users')}>
            Пользователи
          </button>
          <button className={`tab-btn ${adminTab === 'groups' ? 'active' : ''}`} onClick={() => setAdminTab('groups')}>
            Группы
          </button>
          <button className={`tab-btn ${adminTab === 'messages' ? 'active' : ''}`} onClick={() => setAdminTab('messages')}>
            Лог аудита
          </button>
        </div>

        <div className="settings-body" style={{ maxHeight: '600px', overflowY: 'auto' }}>

          {/* STATS TAB */}
          {adminTab === 'stats' && (
            <div>
              <h4 style={{ color: 'white', marginBottom: '1rem' }}>Статус системы Nexa</h4>
              <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Всего пользователей</span>
                  <h2 style={{ fontSize: '2.5rem', color: '#fff', margin: '0.5rem 0 0 0', fontWeight: 800 }}>{adminStats?.totalUsers ?? '...'}</h2>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Всего групп</span>
                  <h2 style={{ fontSize: '2.5rem', color: '#fff', margin: '0.5rem 0 0 0', fontWeight: 800 }}>{adminStats?.totalGroups ?? '...'}</h2>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Сообщений в базе</span>
                  <h2 style={{ fontSize: '2.5rem', color: '#fff', margin: '0.5rem 0 0 0', fontWeight: 800 }}>{adminStats?.totalMessages ?? '...'}</h2>
                </div>
              </div>

              <div style={{ background: 'rgba(0, 242, 255, 0.03)', border: '1px solid rgba(0, 242, 255, 0.1)', borderRadius: '12px', padding: '1.2rem', marginTop: '1rem' }}>
                <h5 style={{ color: '#00efff', margin: '0 0 0.5rem 0', fontWeight: 700 }}>Параметры среды администратора</h5>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  This administration workspace interfaces directly with the back-end SQLite datastore via custom-secured REST query layers. Deleting collections and records compiles real-time cascading transactional cleanses over the environment database.
                </p>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {adminTab === 'users' && (
            <div>
              <h4 style={{ color: 'white', marginBottom: '1rem' }}>Управление пользователями (Всего: {adminUsers.length})</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem' }}>Пользователь</th>
                    <th style={{ padding: '0.75rem' }}>Электронная почта</th>
                    <th style={{ padding: '0.75rem' }}>Роль</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                      <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar" style={{ backgroundColor: u.avatarColor, width: 32, height: 32, fontSize: '10px' }}>
                          {u.initials || getInitials(u.nickname)}
                        </div>
                        <span style={{ fontWeight: 600 }}>{u.nickname}</span>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{u.email || 'N/A'}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontSize: '10px', 
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          backgroundColor: u.role === 'owner' ? 'rgba(192, 132, 252, 0.15)' : u.role === 'admin' ? 'rgba(0,242,255,0.1)' : 'rgba(255,255,255,0.05)',
                          color: u.role === 'owner' ? '#c084fc' : u.role === 'admin' ? '#00efff' : 'var(--text-secondary)'
                        }}>
                          {u.role === 'owner' ? 'Владелец Nexa' : u.role === 'admin' ? 'Админ' : 'Юзер'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          className="btn-outline" 
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: '10px', 
                            marginRight: '5px', 
                            borderRadius: '6px',
                            opacity: currentUser?.role === 'owner' ? 1 : 0.4,
                            cursor: currentUser?.role === 'owner' ? 'pointer' : 'not-allowed'
                          }}
                          onClick={() => {
                            if (currentUser?.role === 'owner') {
                              handleToggleUserRole(u.id, u.role || 'user');
                            }
                          }}
                          disabled={currentUser?.role !== 'owner'}
                          title={currentUser?.role !== 'owner' ? "Только Владелец Nexa может менять роли" : ""}
                        >
                          Изменить роль
                        </button>
                        <button 
                          className="btn-danger" 
                          style={{ 
                            padding: '4px 8px', 
                            fontSize: '10px', 
                            background: '#e74c3c', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '6px', 
                            opacity: (u.id === currentUser?.id || !(currentUser?.role === 'owner' || (currentUser?.role === 'admin' && u.role !== 'admin' && u.role !== 'owner'))) ? 0.4 : 1,
                            cursor: (u.id === currentUser?.id || !(currentUser?.role === 'owner' || (currentUser?.role === 'admin' && u.role !== 'admin' && u.role !== 'owner'))) ? 'not-allowed' : 'pointer'
                          }}
                          onClick={() => handleDeleteUser(u.id)}
                          disabled={u.id === currentUser?.id || !(currentUser?.role === 'owner' || (currentUser?.role === 'admin' && u.role !== 'admin' && u.role !== 'owner'))}
                        >
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* GROUPS TAB */}
          {adminTab === 'groups' && (
            <div>
              <h4 style={{ color: 'white', marginBottom: '1rem' }}>Активные группы (Всего: {adminGroups.length})</h4>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '0.75rem' }}>Группа</th>
                    <th style={{ padding: '0.75rem' }}>Создатель</th>
                    <th style={{ padding: '0.75rem' }}>Участников</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {adminGroups.map(g => (
                    <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: 'white' }}>
                      <td style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar" style={{ backgroundColor: g.avatarColor, width: 32, height: 32, fontSize: '10px' }}>
                          {g.initials || g.name.substring(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 600 }}>{g.name}</span>
                      </td>
                      <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{g.creator?.nickname || 'Unknown'}</td>
                      <td style={{ padding: '0.75rem' }}>{g.members?.length ?? 1} участников</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          className="btn-danger" 
                          style={{ padding: '4px 8px', fontSize: '10px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                          onClick={() => handleDeleteGroup(g.id)}
                        >
                          Удалить группу
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* MESSAGES TAB */}
          {adminTab === 'messages' && (
            <div>
              <h4 style={{ color: 'white', marginBottom: '1rem' }}>Глобальный лог аудита (Последние 100 сообщений)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {adminMessages.map(m => (
                  <div key={m.id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 700, color: m.from.avatarColor }}>{m.from.nickname}</span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          ➞ {m.toGroupId ? `Группа: ${m.toGroup?.name || 'Группа'}` : 'Личное сообщение'}
                        </span>
                        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.7rem' }}>
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: 'white' }}>
                        {m.type === 'image' ? '[Shared Image]' : m.type === 'audio' ? '[Audio Recording]' : m.type === 'video' ? '[Shared Video]' : m.text}
                      </p>
                    </div>
                    <button 
                      style={{ background: 'transparent', border: 'none', color: '#e74c3c', padding: '4px', cursor: 'pointer' }}
                      title="Delete message"
                      onClick={() => handleDeleteMessage(m.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
