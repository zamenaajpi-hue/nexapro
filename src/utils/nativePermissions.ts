import { isNativeAndroidApp } from './platform';

type MediaPermissionRequest = {
  audio?: boolean;
  video?: boolean;
  notifications?: boolean;
};

type PermissionResult = {
  granted: boolean;
  denied: string[];
};

declare global {
  interface Window {
    NexaAndroidPermissions?: {
      requestMediaPermissions: (
        requestId: string,
        audio: boolean,
        video: boolean,
        notifications: boolean,
      ) => void;
    };
  }
}

export function requestNativeMediaPermissions(request: MediaPermissionRequest): Promise<PermissionResult> {
  if (!isNativeAndroidApp() || !window.NexaAndroidPermissions) {
    return Promise.resolve({ granted: true, denied: [] });
  }

  const requestId = `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('nexa:android-permissions-result', handleResult);
      resolve({ granted: false, denied: ['timeout'] });
    }, 15000);

    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<PermissionResult & { requestId?: string }>).detail;
      if (detail?.requestId !== requestId) return;
      window.clearTimeout(timeout);
      window.removeEventListener('nexa:android-permissions-result', handleResult);
      resolve({ granted: detail.granted, denied: detail.denied || [] });
    };

    window.addEventListener('nexa:android-permissions-result', handleResult);
    window.NexaAndroidPermissions.requestMediaPermissions(
      requestId,
      request.audio === true,
      request.video === true,
      request.notifications === true,
    );
  });
}

export async function ensureNativeMediaPermissions(request: MediaPermissionRequest) {
  const result = await requestNativeMediaPermissions(request);
  if (!result.granted) {
    throw new Error(`Android permissions denied: ${result.denied.join(', ') || 'unknown'}`);
  }
}
