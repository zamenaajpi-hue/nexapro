import { openDB, DBSchema } from 'idb';
import type { User } from '../types/chat';

const TOKEN_KEY = 'nexa_token';
const USER_KEY = 'nexa_user';
const AUTH_SESSION_ID = 'default';

interface NexaSessionDB extends DBSchema {
  authSession: {
    key: string;
    value: {
      id: string;
      token: string;
      updatedAt: number;
    };
  };
}

let tokenCache: string | null = null;
let userCache: User | null = null;
let hydrationPromise: Promise<{ token: string | null; user: User | null }> | null = null;

const getSessionDB = () =>
  openDB<NexaSessionDB>('nexa-session-vault', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('authSession')) {
        db.createObjectStore('authSession', { keyPath: 'id' });
      }
    },
  });

const readPersistedToken = async () => {
  try {
    const db = await getSessionDB();
    const stored = await db.get('authSession', AUTH_SESSION_ID);
    return stored?.token || null;
  } catch (error) {
    console.warn('[SESSION] Failed to read persisted auth token:', error);
    return null;
  }
};

const persistToken = async (token: string | null) => {
  try {
    const db = await getSessionDB();
    if (token) {
      await db.put('authSession', {
        id: AUTH_SESSION_ID,
        token,
        updatedAt: Date.now(),
      });
    } else {
      await db.delete('authSession', AUTH_SESSION_ID);
    }
  } catch (error) {
    console.warn('[SESSION] Failed to persist auth token:', error);
  }
};

const readSession = (key: string) => {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeSession = (key: string, value: string) => {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // Keep the in-memory cache as the source of truth if sessionStorage is unavailable.
  }
};

const removeSession = (key: string) => {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

const readLocal = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
};

const removeLocal = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
};

const parseUser = (raw: string | null): User | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};

export const migrateLegacyAuthStorage = async () => {
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    const legacyToken = readLocal(TOKEN_KEY);
    if (legacyToken) {
      tokenCache = legacyToken;
      writeSession(TOKEN_KEY, legacyToken);
      await persistToken(legacyToken);
      removeLocal(TOKEN_KEY);
    } else if (!tokenCache) {
      const sessionToken = readSession(TOKEN_KEY);
      tokenCache = sessionToken || await readPersistedToken();
      if (tokenCache) {
        writeSession(TOKEN_KEY, tokenCache);
      }
    }

    userCache = parseUser(readLocal(USER_KEY));

    return {
      token: tokenCache,
      user: userCache,
    };
  })();

  try {
    return await hydrationPromise;
  } finally {
    hydrationPromise = null;
  }
};

export const getAuthToken = () => {
  if (tokenCache) return tokenCache;
  const sessionToken = readSession(TOKEN_KEY);
  if (sessionToken) {
    tokenCache = sessionToken;
    removeLocal(TOKEN_KEY);
  }
  return tokenCache;
};

export const withAuthHeader = (headers?: HeadersInit) => {
  const nextHeaders = new Headers(headers);
  const token = getAuthToken();
  if (token && !nextHeaders.has('Authorization')) {
    nextHeaders.set('Authorization', `Bearer ${token}`);
  }
  return nextHeaders;
};

export const getStoredUser = () => {
  if (userCache) return userCache;
  userCache = parseUser(readLocal(USER_KEY));
  return userCache;
};

export const storeAuthSession = (data: { token?: string | null; user: User }) => {
  tokenCache = data.token || null;
  userCache = data.user;

  if (data.token) {
    writeSession(TOKEN_KEY, data.token);
    void persistToken(data.token);
  } else {
    removeSession(TOKEN_KEY);
    void persistToken(null);
  }

  writeLocal(USER_KEY, JSON.stringify(data.user));
  removeLocal(TOKEN_KEY);
};

export const updateStoredUser = (user: User) => {
  userCache = user;
  writeLocal(USER_KEY, JSON.stringify(user));
};

export const clearAuthSession = () => {
  tokenCache = null;
  userCache = null;
  removeSession(TOKEN_KEY);
  void persistToken(null);
  removeLocal(TOKEN_KEY);
  removeLocal(USER_KEY);
};
