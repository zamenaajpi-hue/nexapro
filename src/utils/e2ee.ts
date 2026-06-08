import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

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

async function importPrivateKey(privateKeyBase64: string): Promise<CryptoKey> {
  const binaryDer = base64ToArrayBuffer(privateKeyBase64);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "ECDH",
      namedCurve: "P-256"
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

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
  senderPrivateKeyBase64: string
): Promise<string> => {
  if (!message) return '';
  try {
    if (recipientPublicKeyBase64.length > 60 && senderPrivateKeyBase64.length > 60) {
      const senderPrivKey = await importPrivateKey(senderPrivateKeyBase64);
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
    const recipientPublicKey = naclUtil.decodeBase64(recipientPublicKeyBase64);
    const senderPrivateKey = naclUtil.decodeBase64(senderPrivateKeyBase64);
    
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = naclUtil.decodeUTF8(message);
    
    const encrypted = nacl.box(messageUint8, nonce, recipientPublicKey, senderPrivateKey);
    
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
  recipientPrivateKeyBase64: string
): Promise<string> => {
  if (!encryptedMessageBase64) return '';

  if (encryptedMessageBase64.startsWith("aes-gcm:")) {
    const cleanBase64 = encryptedMessageBase64.replace("aes-gcm:", "");
    try {
      const recipientPrivKey = await importPrivateKey(recipientPrivateKeyBase64);
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
        const encryptedMessage = naclUtil.decodeBase64(cleanBase64);
        const senderPublicKey = naclUtil.decodeBase64(senderPublicKeyBase64);
        const recipientPrivateKey = naclUtil.decodeBase64(recipientPrivateKeyBase64);

        const nonce = encryptedMessage.slice(0, nacl.box.nonceLength);
        const message = encryptedMessage.slice(nacl.box.nonceLength);

        const decrypted = nacl.box.open(message, nonce, senderPublicKey, recipientPrivateKey);
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
    const encryptedMessage = naclUtil.decodeBase64(actualMsgText);
    const senderPublicKey = naclUtil.decodeBase64(senderPublicKeyBase64);
    const recipientPrivateKey = naclUtil.decodeBase64(recipientPrivateKeyBase64);
    
    const nonce = encryptedMessage.slice(0, nacl.box.nonceLength);
    const message = encryptedMessage.slice(nacl.box.nonceLength);
    
    const decrypted = nacl.box.open(message, nonce, senderPublicKey, recipientPrivateKey);
    
    if (!decrypted) return '[Старое сообщение недоступно]';
    return naclUtil.encodeUTF8(decrypted);
  } catch (e) {
    console.warn('Decryption failed, might be unencrypted message:', e);
    return encryptedMessageBase64;
  }
};

export const getLocalPrivateKey = () => {
  return localStorage.getItem('nexa_private_key');
};

export const saveLocalPrivateKey = (key: string) => {
  localStorage.setItem('nexa_private_key', key);
};
