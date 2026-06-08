import React, { useState } from 'react';
import { NexaLogo } from '../../shared/ui/NexaLogo';
import { COLORS } from '../../shared/constants';

interface AuthPageProps {
  onAuth: (
    authMode: 'login' | 'register',
    email: string,
    password: string,
    nickname: string,
    selectedColor: string,
    phoneNumber?: string
  ) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuth, loading, error }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAuth(authMode, email, password, nickname, selectedColor, phoneNumber);
  };

  return (
    <div className="screen active" id="login-screen">
      <div className="login-card">
        <div className="logo-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <NexaLogo size={80} showText={true} tagline="ИНТЕЛЛЕКТУАЛЬНАЯ ПЛАТФОРМА СВЯЗИ" />
        </div>

        <p className="subtitle">
          {authMode === 'login' ? 'С возвращением!' : 'Присоединяйтесь к глобальной сети'}
        </p>

        {error && <div className="error-message" style={{ color: '#ff4d4d', marginBottom: '1rem', fontSize: '0.8rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Электронная почта"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {authMode === 'register' && (
            <input
              type="text"
              placeholder="Имя пользователя"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              required
            />
          )}
          {authMode === 'register' && (
            <input
              type="tel"
              placeholder="РўРµР»РµС„РѕРЅ РґР»СЏ РїРѕРёСЃРєР° РІ РєРѕРЅС‚Р°РєС‚Р°С…"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
          )}
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'ВЫПОЛНЕНИЕ...' : (authMode === 'login' ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ')}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {authMode === 'login' ? "Нет аккаунта?" : "Уже есть аккаунт?"}
          <button
            className="btn-link"
            style={{ background: 'none', border: 'none', color: 'var(--accent-color)', marginLeft: '0.5rem', cursor: 'pointer', fontWeight: 600 }}
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
};
