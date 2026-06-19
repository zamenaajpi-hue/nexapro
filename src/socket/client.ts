import { io, Socket } from "socket.io-client";
import { isMobileOrCapacitor } from "../utils/api";
import { readStoredServerUrl, saveStoredServerUrl } from "../utils/serverUrl";

// Get saved dynamic server URL if it exists (highly important for Android/Capacitor)
function getInitialSocketUrl(): string {
  if (isMobileOrCapacitor()) {
    const savedUrl = readStoredServerUrl();
    if (savedUrl) {
      return savedUrl;
    }
  }
  return "";
}

export const socket: Socket = io(getInitialSocketUrl(), {
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 15000,
  reconnectionAttempts: Infinity,
  randomizationFactor: 0.5,
  timeout: 30000,
  upgrade: true,
  autoConnect: false, // Prevents aggressive connection attempts prior to server discovery on mobile
  withCredentials: true,
});

// Mobile VPNs can rotate routes, tunnel DNS, or temporarily suspend WebSocket flows
// while Android switches networks. Socket.IO polling fallback plus explicit online
// reconnect keeps sync alive without requiring certificate pinning changes.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (!socket.connected && socket.auth) {
      socket.connect();
    }
  });
}

export const connectSocket = (token?: string) => {
  // Ensure the Socket URL is fresh in case it was updated
  const currentUrl = getInitialSocketUrl();
  if (socket.io && (socket.io as any).uri !== currentUrl) {
    (socket.io as any).uri = currentUrl;
  }

  if (token) {
    const currentToken = socket.auth && typeof socket.auth === 'object' && 'token' in socket.auth ? (socket.auth as any).token : null;
    if (currentToken !== token) {
      socket.auth = { token };
      if (socket.connected) {
        socket.disconnect().connect();
      }
    }
  } else if (socket.auth && typeof socket.auth === 'object' && 'token' in socket.auth) {
    socket.auth = {};
  }
  if (!socket.connected) {
    socket.connect();
  }
};

export const updateSocketUrl = (url: string, token?: string) => {
  const nextUrl = saveStoredServerUrl(url);
  const wasConnected = socket.connected;

  if (wasConnected) {
    socket.disconnect();
  }

  if (socket.io) {
    (socket.io as any).uri = nextUrl;
  }

  if (token) {
    socket.auth = { token };
  }

  if (wasConnected || token) {
    connectSocket(token);
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
