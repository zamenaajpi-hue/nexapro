import { resolveApiUrl } from './api';
import { Capacitor } from '@capacitor/core';

const STORAGE_KEY = 'nexa_push_subscription';

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

async function registerSubscription(authToken: string, subscription: PushSubscription) {
  const response = await fetch(resolveApiUrl('/api/push/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      platform: 'web',
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || 'Push registration failed');
  }
}

export async function enablePushNotifications(authToken?: string | null) {
  if (!authToken) return false;
  if (!import.meta.env.PROD) return false;

  if (Capacitor.isNativePlatform()) {
    return false;
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
    await registerSubscription(authToken, subscription);
    localStorage.setItem(STORAGE_KEY, serialized);
  }

  return true;
}

export async function disablePushNotifications(authToken?: string | null) {
  try {
    if (authToken && import.meta.env.PROD && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch(resolveApiUrl('/api/push/unregister'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
          }),
        });
        await subscription.unsubscribe().catch(() => {});
      }
    }
  } finally {
    localStorage.removeItem(STORAGE_KEY);
  }
}
