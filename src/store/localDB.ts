import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Message } from '../types/chat';

interface NexaDB extends DBSchema {
  messages: {
    key: string;
    value: Message & { chatId: string };
    indexes: { 'by-chat': string };
  };
  syncQueue: {
    key: string;
    value: { id: string; type: string; payload: any; timestamp: number };
  };
  drafts: {
    key: string;
    value: { chatId: string; text: string; timestamp: number };
  };
}

let dbPromise: Promise<IDBPDatabase<NexaDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<NexaDB>('nexa-db', 2, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('messages')) {
          const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
          msgStore.createIndex('by-chat', 'chatId');
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
    if (text.trim() === '') {
       await db.delete('drafts', chatId);
    } else {
       await db.put('drafts', { chatId, text, timestamp: Date.now() });
    }
  } catch(e) {}
};

export const getDraftLocally = async (chatId: string): Promise<string> => {
  try {
    const db = await initDB();
    const draft = await db.get('drafts', chatId);
    return draft ? draft.text : '';
  } catch {
    return '';
  }
};

export const saveMessageLocally = async (chatId: string, message: Message) => {
  try {
    const db = await initDB();
    await db.put('messages', { ...message, chatId });
  } catch(e) {
    console.error('IDB Error', e);
  }
};

export const saveMessagesLocallyBatch = async (chatId: string, messages: Message[]) => {
  try {
    const db = await initDB();
    const tx = db.transaction('messages', 'readwrite');
    messages.forEach(msg => {
      tx.store.put({ ...msg, chatId });
    });
    await tx.done;
  } catch(e) {
    console.error('IDB Error', e);
  }
};

export const getMessagesLocally = async (chatId: string): Promise<Message[]> => {
  try {
    const db = await initDB();
    return db.getAllFromIndex('messages', 'by-chat', chatId);
  } catch {
    return [];
  }
};

export const queueSyncAction = async (action: { id: string; type: string; payload: any }) => {
  try {
    const db = await initDB();
    await db.put('syncQueue', { ...action, timestamp: Date.now() });
  } catch(e) {
    console.error('IDB Error', e);
  }
};

export const getSyncQueue = async () => {
  try {
    const db = await initDB();
    return db.getAll('syncQueue');
  } catch {
    return [];
  }
};

export const clearSyncAction = async (id: string) => {
  try {
    const db = await initDB();
    await db.delete('syncQueue', id);
  } catch(e) {}
};
