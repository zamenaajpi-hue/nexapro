import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Message } from '../types/chat';

interface NexaDB extends DBSchema {
  messages: {
    key: string;
    value: Message & { chatId: string; userId: string };
    indexes: { 'by-chat': string; 'by-user': string };
  };
  syncQueue: {
    key: string;
    value: { id: string; userId: string; type: string; payload: any; timestamp: number };
  };
  drafts: {
    key: string;
    value: { chatId: string; userId: string; text: string; timestamp: number };
  };
}

let dbPromise: Promise<IDBPDatabase<NexaDB>> | null = null;
let activeUserId: string | null = null;

const readStoredUserId = () => {
  if (activeUserId) return activeUserId;
  if (typeof window === 'undefined') return 'anonymous';

  try {
    const rawUser = localStorage.getItem('nexa_user');
    const parsed = rawUser ? JSON.parse(rawUser) : null;
    return parsed?.id || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const scopedKey = (userId: string, value: string) => `${userId}:${value}`;

export const setLocalDBUser = (userId: string | null) => {
  activeUserId = userId;
};

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NexaDB>('nexa-db', 3, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-chat', 'chatId');
          msgStore.createIndex('by-user', 'userId');
        } else if (!transaction.objectStore('messages').indexNames.contains('by-user')) {
          transaction.objectStore('messages').createIndex('by-user', 'userId');
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'chatId' });
        }
      },
    });
  }
  return dbPromise;
};

export const saveDraftLocally = async (chatId: string, text: string) => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    const key = scopedKey(userId, chatId);
    if (text.trim() === '') {
       await db.delete('drafts', key);
    } else {
       await db.put('drafts', { chatId: key, userId, text, timestamp: Date.now() });
    }
  } catch(e) {}
};

export const getDraftLocally = async (chatId: string): Promise<string> => {
  try {
    const db = await initDB();
    const draft = await db.get('drafts', scopedKey(readStoredUserId(), chatId));
    return draft ? draft.text : '';
  } catch {
    return '';
  }
};

export const saveMessageLocally = async (chatId: string, message: Message) => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    await db.put('messages', { ...message, id: scopedKey(userId, message.id), chatId: scopedKey(userId, chatId), userId });
  } catch(e) {
    console.error('IDB Error', e);
  }
};

export const saveMessagesLocallyBatch = async (chatId: string, messages: Message[]) => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    const scopedChatId = scopedKey(userId, chatId);
    const cleanupTx = db.transaction('messages', 'readwrite');
    const oldKeys = await cleanupTx.store.getAllKeys();
    await Promise.all(
      oldKeys
        .filter((key) => String(key).startsWith(`${userId}:`))
        .map(async (key) => {
          const existing = await cleanupTx.store.get(key);
          if (existing?.chatId === scopedChatId) {
            await cleanupTx.store.delete(key);
          }
        }),
    );
    await cleanupTx.done;

    const tx = db.transaction('messages', 'readwrite');
    messages.forEach(msg => {
      tx.store.put({ ...msg, id: scopedKey(userId, msg.id), chatId: scopedChatId, userId });
    });
    await tx.done;
  } catch(e) {
    console.error('IDB Error', e);
  }
};

export const getMessagesLocally = async (chatId: string): Promise<Message[]> => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    const scopedMessages = await db.getAllFromIndex('messages', 'by-chat', scopedKey(userId, chatId));
    return scopedMessages.map(({ userId: _userId, chatId: _chatId, ...message }) => ({
      ...message,
      id: message.id.startsWith(`${userId}:`) ? message.id.slice(userId.length + 1) : message.id,
    }));
  } catch {
    return [];
  }
};

export const clearMessagesLocally = async (chatId: string) => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    const scopedChatId = scopedKey(userId, chatId);
    const tx = db.transaction('messages', 'readwrite');
    const keys = await tx.store.getAllKeys();
    await Promise.all(
      keys.map(async (key) => {
        const message = await tx.store.get(key);
        if (message?.chatId === scopedChatId) {
          await tx.store.delete(key);
        }
      }),
    );
    await tx.done;
  } catch (error) {
    console.warn('[IDB] Failed to clear local chat messages:', error);
  }
};

export const queueSyncAction = async (action: { id: string; type: string; payload: any }) => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    await db.put('syncQueue', { ...action, id: scopedKey(userId, action.id), userId, timestamp: Date.now() });
  } catch(e) {
    console.error('IDB Error', e);
  }
};

export const getSyncQueue = async () => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    const queued = await db.getAll('syncQueue');
    return queued
      .filter((item) => item.userId === userId)
      .map((item) => ({ ...item, id: item.id.startsWith(`${userId}:`) ? item.id.slice(userId.length + 1) : item.id }));
  } catch {
    return [];
  }
};

export const clearSyncAction = async (id: string) => {
  try {
    const db = await initDB();
    const userId = readStoredUserId();
    await db.delete('syncQueue', id.startsWith(`${userId}:`) ? id : scopedKey(userId, id));
  } catch(e) {}
};

export const clearLocalUserData = async (userId = readStoredUserId()) => {
  try {
    const db = await initDB();
    const tx = db.transaction(['messages', 'drafts', 'syncQueue'], 'readwrite');
    const [messages, drafts, queue] = await Promise.all([
      tx.objectStore('messages').getAllKeys(),
      tx.objectStore('drafts').getAllKeys(),
      tx.objectStore('syncQueue').getAllKeys(),
    ]);

    await Promise.all([
      ...messages.filter((key) => String(key).startsWith(`${userId}:`)).map((key) => tx.objectStore('messages').delete(key)),
      ...drafts.filter((key) => String(key).startsWith(`${userId}:`)).map((key) => tx.objectStore('drafts').delete(key)),
      ...queue.filter((key) => String(key).startsWith(`${userId}:`)).map((key) => tx.objectStore('syncQueue').delete(key)),
    ]);
    await tx.done;
  } catch (error) {
    console.warn('[IDB] Failed to clear local user data:', error);
  }
};
