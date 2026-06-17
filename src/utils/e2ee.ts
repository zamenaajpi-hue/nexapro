import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import { openDB, DBSchema } from 'idb';

export type LocalPrivateKey = string | CryptoKey;

interface NexaE2EEKeyDB extends DBSchema {
  privateKeys: {
    key: string;
    value: {
      id: string;
      key: LocalPrivateKey;
      format: 'webcrypto' | 'base64';
      updatedAt: number;
    };
  };
}

const PRIVATE_KEY_ID = 'default';
const LEGACY_PRIVATE_KEY_STORAGE_KEY = 'nexa_private_key';

let privateKeyCache: LocalPrivateKey | null = null;
let hydratePrivateKeyPromise: Promise<LocalPrivateKey | null> | null = null;

const getKeyDB = () =>
  openDB<NexaE2EEKeyDB>('nexa-e2ee-keys', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('privateKeys')) {
        db.createObjectStore('privateKeys', { keyPath: 'id' });
      }
    },
  });

// Helper to convert Uint8Array to Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to Uint8Array
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const binaryDer = base64ToArrayBuffer(publicKeyBase64);
  return await window.crypto.subtle.importKey(
    "spki",
    binaryDer,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    []
  );
}

async function importPrivateKey(privateKeyBase64: string, extractable = false): Promise<CryptoKey> {
  const binaryDer = base64ToArrayBuffer(privateKeyBase64);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    extractable,
    ["deriveKey", "deriveBits"]
  );
}

const isModernPrivateKey = (key: string) => key.length > 60;

const persistPrivateKey = async (key: LocalPrivateKey) => {
  try {
    const db = await getKeyDB();
    let storedKey = key;
    let format: 'webcrypto' | 'base64' = typeof key === 'string' ? 'base64' : 'webcrypto';

    if (typeof key === 'string' && isModernPrivateKey(key)) {
      storedKey = await importPrivateKey(key, false);
      privateKeyCache = storedKey;
      format = 'webcrypto';
    }

    await db.put('privateKeys', {
      id: PRIVATE_KEY_ID,
      key: storedKey,
      format,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.warn('[E2EE] Failed to persist private key:', error);
  } finally {
    try {
      localStorage.removeItem(LEGACY_PRIVATE_KEY_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  }
};

export const generateKeyPair = async () => {
  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      true,
      ["deriveKey", "deriveBits"]
    );

    const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
    const exportedPrivate = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

    return {
      publicKey: arrayBufferToBase64(exportedPublic),
      privateKey: arrayBufferToBase64(exportedPrivate),
      isModern: true
    };
  } catch (err) {
    console.warn("Web Crypto KeyGen failed, falling back to TweetNaCl:", err);
    const keyPair = nacl.box.keyPair();
    return {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      privateKey: naclUtil.encodeBase64(keyPair.secretKey),
      isModern: false
    };
  }
};

export const encryptMessage = async (
  message: string, 
  recipientPublicKeyBase64: string, 
  senderPrivateKey: LocalPrivateKey
): Promise<string> => {
  if (!message) return '';
  try {
    if (recipientPublicKeyBase64.length > 60 && (typeof senderPrivateKey !== 'string' || isModernPrivateKey(senderPrivateKey))) {
      const senderPrivKey = typeof senderPrivateKey === 'string'
        ? await importPrivateKey(senderPrivateKey)
        : senderPrivateKey;
      const recipientPubKey = await importPublicKey(recipientPublicKeyBase64);
      
      const symmetricKey = await window.crypto.subtle.deriveKey(
        {
          name: "ECDH",
          public: recipientPubKey
        },
        senderPrivKey,
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["encrypt", "decrypt"]
      );

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encodedMessage = new TextEncoder().encode(message);

      const ciphertext = await window.crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        symmetricKey,
        encodedMessage
      );

      const packed = new Uint8Array(iv.length + ciphertext.byteLength);
      packed.set(iv);
      packed.set(new Uint8Array(ciphertext), iv.length);

      return "aes-gcm:" + arrayBufferToBase64(packed);
    }
  } catch (e) {
    console.warn("AES-GCM encryption failed, falling back to TweetNaCl:", e);
  }

  // Fallback to TweetNaCl box
  try {
    if (typeof senderPrivateKey !== 'string') {
      throw new Error('NaCl fallback requires a raw private key');
    }
    const recipientPublicKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
    const senderPrivateKeyBytes = naclUtil.decodeBase64(senderPrivateKey);
    
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = naclUtil.decodeUTF8(message);
    
    const encrypted = nacl.box(messageUint8, nonce, recipientPublicKey, senderPrivateKeyBytes);
    
    const fullMessage = new Uint8Array(nonce.length + encrypted.length);
    fullMessage.set(nonce);
    fullMessage.set(encrypted, nonce.length);
    
    return "nacl:" + naclUtil.encodeBase64(fullMessage);
  } catch (e) {
    console.error('NaCl Encryption fallback failed:', e);
    return message;
  }
};

export const decryptMessage = async (
  encryptedMessageBase64: string, 
  senderPublicKeyBase64: string, 
  recipientPrivateKey: LocalPrivateKey
): Promise<string> => {
  if (!encryptedMessageBase64) return '';

  if (encryptedMessageBase64.startsWith("aes-gcm:")) {
    const cleanBase64 = encryptedMessageBase64.replace("aes-gcm:", "");
    try {
      const recipientPrivKey = typeof recipientPrivateKey === 'string'
        ? await importPrivateKey(recipientPrivateKey)
        : recipientPrivateKey;
      const senderPubKey = await importPublicKey(senderPublicKeyBase64);
      
      const symmetricKey = await window.crypto.subtle.deriveKey(
        {
          name: "ECDH",
          public: senderPubKey
        },
        recipientPrivKey,
        {
          name: "AES-GCM",
          length: 256
        },
        false,
        ["encrypt", "decrypt"]
      );

      const packed = base64ToArrayBuffer(cleanBase64);
      const iv = packed.slice(0, 12);
      const ciphertext = packed.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: iv
        },
        symmetricKey,
        ciphertext
      );

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error("AES-GCM decryption failed:", e);
      try {
        if (typeof recipientPrivateKey !== 'string') {
          throw new Error('NaCl fallback requires a raw private key');
        }
        const encryptedMessage = naclUtil.decodeBase64(cleanBase64);
        const senderPublicKey = naclUtil.decodeBase64(senderPublicKeyBase64);
        const recipientPrivateKeyBytes = naclUtil.decodeBase64(recipientPrivateKey);

        const nonce = encryptedMessage.slice(0, nacl.box.nonceLength);
        const message = encryptedMessage.slice(nacl.box.nonceLength);

        const decrypted = nacl.box.open(message, nonce, senderPublicKey, recipientPrivateKeyBytes);
        if (decrypted) {
          return naclUtil.encodeUTF8(decrypted);
        }
      } catch (legacyError) {
        console.warn('AES fallback to NaCl also failed:', legacyError);
      }

      return "[Старое сообщение недоступно]";
    }
  }

  const actualMsgText = encryptedMessageBase64.startsWith("nacl:") 
    ? encryptedMessageBase64.replace("nacl:", "") 
    : encryptedMessageBase64;

  try {
    if (typeof recipientPrivateKey !== 'string') {
      throw new Error('NaCl payload requires a raw private key');
    }
    const encryptedMessage = naclUtil.decodeBase64(actualMsgText);
    const senderPublicKey = naclUtil.decodeBase64(senderPublicKeyBase64);
    const recipientPrivateKeyBytes = naclUtil.decodeBase64(recipientPrivateKey);
    
    const nonce = encryptedMessage.slice(0, nacl.box.nonceLength);
    const message = encryptedMessage.slice(nacl.box.nonceLength);
    
    const decrypted = nacl.box.open(message, nonce, senderPublicKey, recipientPrivateKeyBytes);
    
    if (!decrypted) return '[Старое сообщение недоступно]';
    return naclUtil.encodeUTF8(decrypted);
  } catch (e) {
    console.warn('Decryption failed, might be unencrypted message:', e);
    return encryptedMessageBase64;
  }
};

export const getLocalPrivateKey = () => {
  return privateKeyCache;
};

export const getLocalPrivateKeyAsync = async () => {
  if (privateKeyCache) return privateKeyCache;
  return hydrateLocalPrivateKey();
};

export const saveLocalPrivateKey = (key: LocalPrivateKey) => {
  privateKeyCache = key;
  void persistPrivateKey(key);
};

export const hydrateLocalPrivateKey = async () => {
  if (privateKeyCache) return privateKeyCache;
  if (hydratePrivateKeyPromise) return hydratePrivateKeyPromise;

  hydratePrivateKeyPromise = (async () => {
    try {
      const db = await getKeyDB();
      const stored = await db.get('privateKeys', PRIVATE_KEY_ID);
      if (stored?.key) {
        privateKeyCache = stored.key;
        try {
          localStorage.removeItem(LEGACY_PRIVATE_KEY_STORAGE_KEY);
        } catch {
          // Ignore storage failures.
        }
        return privateKeyCache;
      }
    } catch (error) {
      console.warn('[E2EE] Failed to read private key from IndexedDB:', error);
    }

    try {
      const legacyKey = localStorage.getItem(LEGACY_PRIVATE_KEY_STORAGE_KEY);
      if (legacyKey) {
        privateKeyCache = legacyKey;
        await persistPrivateKey(legacyKey);
        return privateKeyCache;
      }
    } catch (error) {
      console.warn('[E2EE] Failed to migrate legacy private key:', error);
    }

    return null;
  })();

  try {
    return await hydratePrivateKeyPromise;
  } finally {
    hydratePrivateKeyPromise = null;
  }
};

export const clearLocalPrivateKey = async () => {
  privateKeyCache = null;
  try {
    localStorage.removeItem(LEGACY_PRIVATE_KEY_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }

  try {
    const db = await getKeyDB();
    await db.delete('privateKeys', PRIVATE_KEY_ID);
  } catch (error) {
    console.warn('[E2EE] Failed to clear private key:', error);
  }
};
