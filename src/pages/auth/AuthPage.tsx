import React, { useEffect, useRef, useState } from 'react';
import { NexaLogo } from '../../shared/ui/NexaLogo';
import { COLORS } from '../../shared/constants';

declare global {
  interface Window {
    google?: any;
  }
}

interface AuthPageProps {
  onAuth: (
    authMode: 'login' | 'register',
    email: string,
    password: string,
    nickname: string,
    selectedColor: string,
    phoneNumber?: string,
  ) => Promise<void>;
  onGoogleAuth: (token: { credential?: string; accessToken?: string }, selectedColor: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

const GOOGLE_CLIENT_ID_PATTERN = /^[0-9a-zA-Z_-]+\.apps\.googleusercontent\.com$/;
const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^CHANGE_ME$/i,
  /^MY_/i,
  /^your-/i,
  /^1234567890-/i,
  /example/i,
];
const getValidGoogleClientId = (value?: string | null) => {
  const normalized = String(value || '').trim();
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(normalized))) return undefined;
  return GOOGLE_CLIENT_ID_PATTERN.test(normalized) ? normalized : undefined;
};
const BUILD_GOOGLE_CLIENT_ID = getValidGoogleClientId(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined);
const RUSSIAN_PHONE_REGEX = /^(?:\+7|8)\d{10}$/;
const PHONE_HINT = 'Введите номер в формате +7XXXXXXXXXX или 8XXXXXXXXXX';

const normalizePhoneInput = (value: string) => {
  const cleaned = value.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '').slice(0, 11)}`;
  }
  return cleaned.replace(/\D/g, '').slice(0, 11);
};

export const AuthPage: React.FC<AuthPageProps> = ({ onAuth, onGoogleAuth, loading, error }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string | undefined>(BUILD_GOOGLE_CLIENT_ID);
  const [googleReady, setGoogleReady] = useState(false);
  const [selectedColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);
  const googleTokenClientRef = useRef<any>(null);

  useEffect(() => {
    if (googleClientId) return;

    let cancelled = false;
    fetch('/runtime-config.json', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((config: { googleClientId?: string | null } | null) => {
        if (!cancelled) setGoogleClientId(getValidGoogleClientId(config?.googleClientId));
      })
      .catch(() => {
        if (!cancelled) setGoogleClientId(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId]);

  useEffect(() => {
    if (!googleClientId) return;

    let cancelled = false;
    const scriptId = 'google-identity-services';

    const initializeGoogle = () => {
      if (cancelled || !window.google?.accounts?.oauth2) return;

      googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: googleClientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: (response: { access_token?: string; error?: string }) => {
          if (response.error) {
            setLocalError('Google вход отменен или недоступен');
            return;
          }
          if (response.access_token) {
            void onGoogleAuth({ accessToken: response.access_token }, selectedColor);
          }
        },
      });

      setGoogleReady(true);
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if (window.google?.accounts?.oauth2) initializeGoogle();
      else existingScript.addEventListener('load', initializeGoogle, { once: true });
      return () => {
        cancelled = true;
        existingScript.removeEventListener('load', initializeGoogle);
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.addEventListener('load', initializeGoogle, { once: true });
    script.addEventListener('error', () => {
      if (!cancelled) setLocalError('Не удалось загрузить Google вход');
    }, { once: true });
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener('load', initializeGoogle);
    };
  }, [googleClientId, onGoogleAuth, selectedColor]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (authMode === 'register' && phoneNumber.trim() && !RUSSIAN_PHONE_REGEX.test(phoneNumber.trim())) {
      setLocalError(PHONE_HINT);
      return;
    }

    onAuth(authMode, email.trim(), password, nickname.trim(), selectedColor, phoneNumber.trim());
  };

  const handleGoogleClick = () => {
    setLocalError(null);

    if (!googleClientId) {
      setLocalError('Google вход не настроен: укажите VITE_GOOGLE_CLIENT_ID и GOOGLE_CLIENT_ID в .env');
      return;
    }

    if (!googleReady || !googleTokenClientRef.current) {
      setLocalError('Google вход еще загружается. Попробуйте через пару секунд');
      return;
    }

    googleTokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
  };

  const visibleError = localError || error;

  return (
    <div className="screen active" id="login-screen">
      <div className="login-card">
        <div className="logo-container">
          <NexaLogo size={80} showText={true} tagline="Интеллектуальная платформа связи" />
        </div>

        <p className="subtitle">
          {authMode === 'login' ? 'С возвращением!' : 'Присоединяйтесь к глобальной сети'}
        </p>

        {visibleError && <div className="error-message">{visibleError}</div>}

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
              placeholder="+79991234567 или 89991234567"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(normalizePhoneInput(event.target.value))}
              pattern="^(?:\+7|8)\d{10}$"
              title={PHONE_HINT}
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
            {loading ? 'Проверяем...' : authMode === 'login' ? 'Войти' : 'Создать аккаунт'}
          </button>

          {googleClientId && (
            <div className="google-auth-compact">
              <button
                type="button"
                className="btn-google-icon"
                onClick={handleGoogleClick}
                disabled={loading}
                aria-label="Войти через Google"
                title="Войти через Google"
              >
                <img src="/google-logo.svg" alt="" aria-hidden="true" />
              </button>
            </div>
          )}
        </form>

        <p className="auth-switch-copy">
          {authMode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setLocalError(null);
            }}
          >
            {authMode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </button>
        </p>
      </div>
    </div>
  );
};
