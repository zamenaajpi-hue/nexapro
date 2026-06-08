import React, { useEffect, useState } from 'react';
import { X, ShoppingBag, Check } from 'lucide-react';
import { socket } from '../../socket/client';
import { User } from '../../types/chat';

interface AvatarItem {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
}

interface MarketplaceModalProps {
  onClose: () => void;
  user: User;
}

export const MarketplaceModal: React.FC<MarketplaceModalProps> = ({ onClose, user }) => {
  const [items, setItems] = useState<AvatarItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    socket.emit('market:get-items');
    socket.on('market:items', (data: AvatarItem[]) => {
      setItems(data);
      setLoading(false);
    });

    return () => {
      socket.off('market:items');
    };
  }, []);

  const handleBuy = (itemId: string) => {
    socket.emit('market:buy-avatar', { avatarId: itemId });
  };

  const ownedAvatars = JSON.parse(user.ownedAvatars || '[]');

  return (
    <div className="modal active" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ShoppingBag className="text-accent" size={24} />
            <h2 style={{ margin: 0 }}>МИТ-МАРКЕТ: ЭЛИТНЫЕ АВАТАРЫ</h2>
          </div>
          <button className="close-modal" onClick={onClose}><X size={24} /></button>
        </div>

        <div style={{ background: 'var(--message-in)', padding: '12px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Ваш баланс:</span>
          <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-color)' }}>{user.balance?.toLocaleString()} NEXA</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>Грузим роскошь...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
            {items.map(item => {
              const isOwned = ownedAvatars.includes(item.imageUrl);
              return (
                <div key={item.id} style={{ 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '16px', 
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'transform 0.2s',
                  position: 'relative'
                }}>
                  <div style={{ 
                    width: '100%', 
                    aspectRatio: '1', 
                    borderRadius: '12px', 
                    backgroundImage: `url(${item.imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: 'rgba(255,255,255,0.05)'
                  }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>{item.name}</div>
                    <div style={{ color: 'var(--accent-color)', fontWeight: 800, fontSize: '0.9rem' }}>{item.price} NEXA</div>
                  </div>
                  
                  <button 
                    disabled={isOwned || (user.balance || 0) < item.price}
                    onClick={() => handleBuy(item.id)}
                    style={{ 
                      width: '100%', 
                      padding: '8px', 
                      borderRadius: '8px', 
                      border: 'none',
                      background: isOwned ? 'rgba(16, 185, 129, 0.2)' : 'var(--accent-color)',
                      color: isOwned ? '#10b981' : '#030303',
                      fontWeight: 700,
                      cursor: isOwned ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      opacity: (isOwned || (user.balance || 0) < item.price) && !isOwned ? 0.5 : 1
                    }}
                  >
                    {isOwned ? <><Check size={14} /> КУПЛЕНО</> : 'КУПИТЬ'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
