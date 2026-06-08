import webpush from 'web-push';
import admin from 'firebase-admin';
import { db } from '../../services/db';

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  kind?: 'message' | 'call';
  chatId?: string;
  fromId?: string;
  fromName?: string;
};

const DEFAULT_VAPID_SUBJECT = 'mailto:admin@nexa.local';

let vapidConfigured = false;
let firebaseConfigured = false;

function ensureVapidConfig() {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || DEFAULT_VAPID_SUBJECT;
  if (!publicKey || !privateKey || publicKey === 'CHANGE_ME' || privateKey === 'CHANGE_ME') {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function parseSubscriptionToken(token: string): any | null {
  try {
    const parsed = JSON.parse(token);
    if (parsed && typeof parsed === 'object' && parsed.endpoint) {
      return parsed;
    }
  } catch {
    // Legacy/non-web-push token, ignore.
  }
  return null;
}

async function removeExpiredToken(token: string) {
  await db.pushToken.deleteMany({ where: { token } }).catch(() => {});
}

function ensureFirebaseConfig() {
  if (firebaseConfigured) return admin.apps.length > 0;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (admin.apps.length > 0) {
    firebaseConfigured = true;
    return true;
  }

  try {
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      firebaseConfigured = true;
      return true;
    }

    if (projectId && clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        } as admin.ServiceAccount),
      });
      firebaseConfigured = true;
      return true;
    }
  } catch (error) {
    console.warn('[PUSH] Firebase admin init failed:', error);
  }

  firebaseConfigured = false;
  return false;
}

async function sendFcmNotification(token: string, payload: PushPayload) {
  if (!ensureFirebaseConfig()) return;

  const message: admin.messaging.Message = {
    token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: payload.url || '/',
      kind: payload.kind || 'message',
      chatId: payload.chatId || '',
      fromId: payload.fromId || '',
      fromName: payload.fromName || '',
    },
    android: {
      priority: 'high',
      notification: {
        channelId: payload.kind === 'call' ? 'calls' : 'messages',
      },
    },
  };

  try {
    await admin.messaging().send(message);
  } catch (error: any) {
    const code = String(error?.errorInfo?.code || error?.code || '');
    if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
      await removeExpiredToken(token);
      return;
    }
    console.error('[PUSH_ERR] Failed to send FCM notification:', error);
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const canSendWebPush = ensureVapidConfig();

  const tokens = await db.pushToken.findMany({ where: { userId } });
  if (!tokens.length) return;

  const body = JSON.stringify({
    ...payload,
    url: payload.url || '/',
  });

  for (const record of tokens) {
    if (record.platform === 'web' || record.token.trim().startsWith('{')) {
      if (!canSendWebPush) continue;
      const subscription = parseSubscriptionToken(record.token);
      if (!subscription) continue;

      try {
        await webpush.sendNotification(subscription, body);
      } catch (error: any) {
        const statusCode = error?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeExpiredToken(record.token);
          continue;
        }
        console.error('[PUSH_ERR] Failed to send push notification:', error);
      }
      continue;
    }

    if (record.platform === 'android' || record.platform === 'ios') {
      await sendFcmNotification(record.token, payload);
    }
  }
}

export async function sendPushToMany(userIds: string[], payload: PushPayload) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  await Promise.all(uniqueUserIds.map((userId) => sendPushToUser(userId, payload)));
}
