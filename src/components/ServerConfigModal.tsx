import React, { useState, useEffect } from 'react';
import { readStoredServerUrl, saveStoredServerUrl } from '../utils/serverUrl';
import { fetchHealthCheck } from '../utils/nativeHttp';

interface ServerConfigModalProps {
  onSubmit: (serverUrl: string) => void;
  isVisible: boolean;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({ onSubmit, isVisible }) => {
  const [serverUrl, setServerUrl] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load saved server URL if exists
    const saved = readStoredServerUrl();
    if (saved) {
      setServerUrl(saved);
    }
  }, []);

  const validateUrl = (url: string): boolean => {
    try {
      const urlObj = new URL(url);
      // Check if it's http or https
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!serverUrl.trim()) {
      setError('Пожалуйста, введите адрес сервера');
      return;
    }

    if (!validateUrl(serverUrl)) {
      setError('Неверный формат URL (используйте http:// или https://)');
      return;
    }

    setIsLoading(true);
    try {
      // Test connection to server
      const response = await fetchHealthCheck(serverUrl, 5000).catch(() => {
        throw new Error('Не удается подключиться к серверу');
      });

      if (!response.ok) {
        throw new Error('Сервер недоступен');
      }

      // Save to both storages
      saveStoredServerUrl(serverUrl);

      console.log('[Config] Server URL saved:', serverUrl);
      onSubmit(serverUrl);
    } catch (err) {
      console.error('[Config] Connection test failed:', err);
      setError('Ошибка подключения. Проверьте адрес сервера и попробуйте снова.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="server-config-modal">
      <div className="server-config-overlay" />
      <div className="server-config-container">
        <div className="server-config-content">
          <h1>⚙️ Настройка сервера</h1>
          <p className="server-config-description">
            Введите адрес вашего NEXA сервера для подключения
          </p>

          <form onSubmit={handleSubmit}>
            <div className="server-config-input-group">
              <label htmlFor="serverUrl">Адрес сервера:</label>
              <input
                id="serverUrl"
                type="url"
                value={serverUrl}
                onChange={(e) => {
                  setServerUrl(e.target.value);
                  setError('');
                }}
                placeholder="https://your-server.com"
                disabled={isLoading}
                className="server-config-input"
              />
              <small>Пример: http://192.168.1.100:3000</small>
              <small>или https://nexa.example.com</small>
            </div>

            {error && (
              <div className="server-config-error">
                <span>❌ {error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !serverUrl.trim()}
              className="server-config-submit"
            >
              {isLoading ? '⏳ Проверка подключения...' : '✅ Подключиться'}
            </button>
          </form>

          <div className="server-config-tips">
            <h3>💡 Советы:</h3>
            <ul>
              <li>Используйте IP адрес если сервер локальный (например, 192.168.1.100:3000)</li>
              <li>Для удаленного сервера используйте доменное имя (example.com)</li>
              <li>Убедитесь что порт открыт и доступен</li>
              <li>Адрес будет сохранен для последующих запусков</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        .server-config-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
        }

        .server-config-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
        }

        .server-config-container {
          position: relative;
          z-index: 1;
          width: 90%;
          max-width: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 30px;
          animation: slideUp 0.3s ease-out;
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .server-config-content h1 {
          margin: 0 0 10px 0;
          font-size: 24px;
          color: #333;
        }

        .server-config-description {
          margin: 0 0 20px 0;
          color: #666;
          font-size: 14px;
        }

        .server-config-input-group {
          margin-bottom: 20px;
        }

        .server-config-input-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .server-config-input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          font-family: monospace;
          transition: border-color 0.3s;
          box-sizing: border-box;
        }

        .server-config-input:focus {
          outline: none;
          border-color: #007AFF;
          background: #f9f9f9;
        }

        .server-config-input:disabled {
          background: #f5f5f5;
          color: #999;
        }

        .server-config-input-group small {
          display: block;
          margin-top: 6px;
          color: #999;
          font-size: 12px;
        }

        .server-config-error {
          padding: 12px;
          background: #fee;
          border: 1px solid #fcc;
          border-radius: 6px;
          color: #c33;
          margin-bottom: 15px;
          font-size: 13px;
        }

        .server-config-submit {
          width: 100%;
          padding: 12px;
          background: #007AFF;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.3s;
          margin-bottom: 20px;
        }

        .server-config-submit:hover:not(:disabled) {
          background: #0051D5;
        }

        .server-config-submit:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .server-config-tips {
          background: #f0f8ff;
          padding: 15px;
          border-radius: 8px;
          border-left: 4px solid #007AFF;
        }

        .server-config-tips h3 {
          margin: 0 0 10px 0;
          font-size: 13px;
          color: #0051D5;
        }

        .server-config-tips ul {
          margin: 0;
          padding-left: 20px;
          font-size: 12px;
          color: #666;
        }

        .server-config-tips li {
          margin-bottom: 6px;
        }

        /* Mobile optimizations */
        @media (max-width: 600px) {
          .server-config-container {
            width: 95%;
            padding: 20px;
          }

          .server-config-content h1 {
            font-size: 20px;
          }
        }
      `}</style>
    </div>
  );
};

export default ServerConfigModal;
