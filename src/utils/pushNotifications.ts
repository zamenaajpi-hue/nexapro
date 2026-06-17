import { resolveApiUrl } from './api';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'nexa_push_subscription';
const NATIVE_TOKEN_KEY = 'nexa_native_push_token';
let nativeListenersConfigured = false;

function isNativePushEnabled() {
  return import.meta.env.VITE_ENABLE_NATIVE_PUSH === 'true';
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function getVapidPublicKey() {
  return import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
}

async function registerPushToken(authToken: string, payload: { subscription?: PushSubscription | any; token?: string; platform: string }) {
  const response = await fetch(resolveApiUrl('/api/push/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      subscription: payload.subscription?.toJSON ? payload.subscription.toJSON() : payload.subscription,
      token: payload.token,
      platform: payload.platform,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Push registration failed');
  }
}

async function unregisterPushToken(authToken: string, payload: { subscription?: PushSubscription | any; token?: string }) {
  await fetch(resolveApiUrl('/api/push/unregister'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      subscription: payload.subscription?.toJSON ? payload.subscription.toJSON() : payload.subscription,
      token: payload.token,
    }),
  }).catch(() => {});
}

async function enableNativePushNotifications(authToken: string) {
  const { PushNotifications } = await import('@capacitor/push-notifications');

  if (!nativeListenersConfigured) {
    nativeListenersConfigured = true;

    await PushNotifications.addListener('registration', async ({ value }) => {
      localStorage.setItem(NATIVE_TOKEN_KEY, value);
      await registerPushToken(authToken, {
        token: value,
        platform: Capacitor.getPlatform(),
      });
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.warn('[PUSH] Native registration failed:', error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const title = notification.title || 'NEXA';
      const body = notification.body || 'Новое событие';
      window.dispatchEvent(new CustomEvent('nexa:notify', {
        detail: { message: `${title}: ${body}`, type: 'info' },
      }));
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
      window.dispatchEvent(new CustomEvent('nexa:push-open', {
        detail: notification.data || {},
      }));
    });
  }

  const permission = await PushNotifications.checkPermissions();
  const receive = permission.receive === 'granted'
    ? 'granted'
    : (await PushNotifications.requestPermissions()).receive;

  if (receive !== 'granted') return false;

  await PushNotifications.register();
  return true;
}

export async function enablePushNotifications(authToken?: string | null) {
  if (!authToken) return false;
  if (!import.meta.env.PROD) return false;

  if (Capacitor.isNativePlatform()) {
    if (!isNativePushEnabled()) {
      console.info('[PUSH] Native push disabled. Add Firebase google-services.json and set VITE_ENABLE_NATIVE_PUSH=true to enable it.');
      return false;
    }
    return enableNativePushNotifications(authToken);
  }

  const vapidPublicKey = getVapidPublicKey();
  if (!vapidPublicKey || vapidPublicKey === 'CHANGE_ME') {
    return false;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return false;
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
  if (permission !== 'granted') {
    return false;
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const serialized = JSON.stringify(subscription.toJSON());
  if (localStorage.getItem(STORAGE_KEY) !== serialized) {
    await registerPushToken(authToken, {
      subscription,
      platform: 'web',
    });
    localStorage.setItem(STORAGE_KEY, serialized);
  }

  return true;
}

export async function disablePushNotifications(authToken?: string | null) {
  try {
    if (authToken && Capacitor.isNativePlatform()) {
      const nativeToken = localStorage.getItem(NATIVE_TOKEN_KEY);
      if (nativeToken) {
        await unregisterPushToken(authToken, { token: nativeToken });
      }
      return;
    }

    if (authToken && import.meta.env.PROD && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unregisterPushToken(authToken, { subscription });
        await subscription.unsubscribe().catch(() => {});
      }
    }
  } finally {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NATIVE_TOKEN_KEY);
  }
}
