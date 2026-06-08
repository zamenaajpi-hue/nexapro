import { Capacitor, CapacitorHttp } from '@capacitor/core';

export const isNativeCapacitor = (): boolean => Capacitor.isNativePlatform();

export const fetchHealthCheck = async (
  url: string,
  timeoutMs = 5000,
): Promise<{ ok: boolean; status: number }> => {
  const cleanUrl = url.trim().replace(/\/$/, '');

  if (isNativeCapacitor()) {
    const response = await CapacitorHttp.get({
      url: `${cleanUrl}/api/health`,
      connectTimeout: timeoutMs,
      readTimeout: timeoutMs,
    });

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
    };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${cleanUrl}/api/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
};
