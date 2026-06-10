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
    phoneNumber?: string,
  ) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const normalizePhoneInput = (value: string) => value.replace(/[^\d+()\-\s]/g, '').slice(0, 32);

export const AuthPage: React.FC<AuthPageProps> = ({ onAuth, loading, error }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onAuth(authMode, email.trim(), password, nickname.trim(), selectedColor, phoneNumber.trim());
  };

  return (
    <div className="screen active" id="login-screen">
      <div className="login-card">
        <div className="logo-container">
          <NexaLogo size={80} showText={true} tagline="ИНТЕЛЛЕКТУАЛЬНАЯ ПЛАТФОРМА СВЯЗИ" />
        </div>

        <p className="subtitle">
          {authMode === 'login' ? 'С возвращением!' : 'Присоединяйтесь к глобальной сети'}
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Электронная почта"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          {authMode === 'register' && (
            <input
              type="text"
              placeholder="Имя пользователя"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              minLength={2}
              required
            />
          )}

          {authMode === 'register' && (
            <input
              type="tel"
              inputMode="tel"
              placeholder="Телефон для поиска в контактах"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(normalizePhoneInput(event.target.value))}
            />
          )}

          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Выполняем...' : authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>

        <p className="auth-switch-copy">
          {authMode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
          <button
            type="button"
            className="btn-link"
            onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          >
            {authMode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
};
