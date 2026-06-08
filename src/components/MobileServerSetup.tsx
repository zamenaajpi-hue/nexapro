import React, { useState } from 'react';
import { Shield, Sparkles, Check, AlertCircle } from 'lucide-react';
import { updateSocketUrl } from '../socket/client';
import { saveStoredServerUrl } from '../utils/serverUrl';
import { fetchHealthCheck } from '../utils/nativeHttp';

interface MobileServerSetupProps {
  onConfigured: (url: string) => void;
}

export const MobileServerSetup: React.FC<MobileServerSetupProps> = ({ onConfigured }) => {
  const [serverUrl, setServerUrl] = useState('');
  const [status, setStatus] = useState<{ message: string; type: 'idle' | 'loading' | 'success' | 'error' }>({
    message: '',
    type: 'idle'
  });

  const handlePreset = (url: string) => {
    setServerUrl(url);
    setStatus({ message: '', type: 'idle' });
  };

  const handleConnect = async (forceType = false) => {
    let targetUrl = serverUrl.trim();
    if (!targetUrl) {
      setStatus({ message: 'Пожалуйста, укажите URL-адрес сервера.', type: 'error' });
      return;
    }

    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'http://' + targetUrl;
    }

    setStatus({ message: 'Проверка подключения к серверу...', type: 'loading' });

    if (forceType) {
      const savedUrl = saveStoredServerUrl(targetUrl);
      updateSocketUrl(savedUrl);
      setStatus({ message: 'Принудительное подключение...', type: 'success' });
      setTimeout(() => {
        onConfigured(savedUrl);
      }, 800);
      return;
    }

    try {
      const cleanUrl = targetUrl.replace(/\/$/, "");
      const res = await fetchHealthCheck(cleanUrl, 4000);

      // Server is online if it responds with a success status or even auth-required checks
      if (res.ok || res.status === 401 || res.status === 403) {
        const savedUrl = saveStoredServerUrl(cleanUrl);
        updateSocketUrl(savedUrl);
        setStatus({ message: 'Успешно подключено к серверу!', type: 'success' });
        setTimeout(() => {
          onConfigured(savedUrl);
        }, 800);
      } else {
        throw new Error(`Ошибка ответа: ${res.status}`);
      }
    } catch (err) {
      setStatus({
        message: 'Не удалось установить соединение. Проверьте запущен ли сервер или адрес.',
        type: 'error'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F0F10] text-[#E4E4E7] font-sans selection:bg-[#00F5D4]/20 selection:text-[#00F5D4]">
      {/* Background Decorative Blur Gradients */}
      <div className="absolute inset-x-0 top-1/4 -translate-y-1/2 mx-auto w-72 h-72 bg-[#00F5D4]/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute inset-x-0 bottom-1/4 translate-y-1/2 mx-auto w-72 h-72 bg-[#9B5DE5]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md p-6 bg-[#18181B]/90 backdrop-blur-md rounded-2xl border border-zinc-800/10 shadow-2xl relative z-10">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#00F5D4] via-[#00B4D8] to-[#9B5DE5] p-[1px] flex items-center justify-center shadow-lg shadow-[#00F5D4]/10 mb-4 animate-pulse">
            <div className="w-full h-full bg-[#18181B] rounded-2xl flex items-center justify-center">
              <Shield className="w-8 h-8 text-[#00F5D4]" />
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Настройка подключения</h2>
          <p className="text-xs text-zinc-400 max-w-xs">
            Для работы мобильного приложения Nexa Messenger необходимо подключиться к вашему серверу.
          </p>
        </div>

        {/* Dynamic Status Box */}
        {status.message && (
          <div className={`p-3 rounded-lg mb-4 text-xs flex items-start gap-2 border ${
            status.type === 'loading' ? 'bg-[#00B4D8]/5 border-[#00B4D8]/20 text-[#00B4D8]' :
            status.type === 'success' ? 'bg-[#00F5D4]/5 border-[#00F5D4]/20 text-[#00F5D4]' :
            'bg-red-500/5 border-red-500/20 text-red-400'
          }`}>
            {status.type === 'loading' ? (
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-[#00B4D8] animate-spin shrink-0" />
            ) : status.type === 'success' ? (
              <Check className="w-4 h-4 text-[#00F5D4] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {/* Inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5Packed font-sans">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-widest">Адрес сервера (URL)</label>
            <input
              type="text"
              className="w-full bg-[#0F0F10] border border-zinc-800 focus:border-[#00F5D4]/50 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition focus:shadow-md focus:shadow-[#00F5D4]/2"
              placeholder="http://192.168.1.100:3000"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              disabled={status.type === 'loading'}
            />
          </div>

          {/* Quick Selection Presets */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Быстрый выбор</h4>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                className="w-full px-3 py-2 text-left bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs transition duration-150 flex items-center justify-between"
                onClick={() => handlePreset('http://10.0.2.2:3000')}
              >
                <span>Локальный эмулятор Android (10.0.2.2:3000)</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-[#00F5D4]/10 text-[#00F5D4] rounded">Emulator</span>
              </button>

              <button
                type="button"
                className="w-full px-3 py-2 text-left bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs transition duration-150 flex items-center justify-between"
                onClick={() => handlePreset('https://ais-dev-7bgky7op2qkpdmgoz7hysn-816012459690.europe-west2.run.app')}
              >
                <span className="truncate">Виртуальный сервер AI Studio (Dev)</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-[#00B4D8]/10 text-[#00B4D8] rounded shrink-0">Cloud Dev</span>
              </button>

              <button
                type="button"
                className="w-full px-3 py-2 text-left bg-zinc-900 hover:bg-zinc-800 active:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg text-xs transition duration-150 flex items-center justify-between"
                onClick={() => handlePreset('https://ais-pre-7bgky7op2qkpdmgoz7hysn-816012459690.europe-west2.run.app')}
              >
                <span className="truncate">Виртуальный сервер AI Studio (Pre)</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-[#9B5DE5]/10 text-[#9B5DE5] rounded shrink-0">Cloud Pre</span>
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              className="w-full bg-[#00F5D4] hover:bg-[#00D2B4] hover:scale-[1.01] active:scale-[0.99] text-zinc-950 font-bold py-2.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-[#00F5D4]/10 disabled:opacity-50 disabled:scale-100"
              onClick={() => handleConnect(false)}
              disabled={status.type === 'loading'}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              Подключиться
            </button>

            {status.type === 'error' && (
              <button
                type="button"
                className="w-full border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 py-2.5 rounded-lg text-xs transition duration-150 flex items-center justify-center gap-1"
                onClick={() => handleConnect(true)}
              >
                Принудительное подключение
              </button>
            )}
          </div>
        </div>

        {/* Mini Guide */}
        <div className="mt-5 border-t border-zinc-800/60 pt-4 font-sans text-[11px] leading-relaxed text-zinc-500">
          <p className="font-semibold text-zinc-300 mb-1">💡 Как объединить мобильное устройство и ПК:</p>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>Убедитесь, что телефон и ПК подключены к одному Wi-Fi.</li>
            <li>Запустите сервер на ПК с помощью команды <code className="text-zinc-300 bg-zinc-900 px-1 py-0.5 rounded">npm start</code>.</li>
            <li>Укажите локальный IP вашего ПК (например, <code className="text-[#00F5D4]/80">http://192.168.1.55:3000</code>).</li>
          </ul>
        </div>

      </div>
    </div>
  );
};
