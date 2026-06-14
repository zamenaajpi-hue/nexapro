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
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: Infinity,
  timeout: 20000,
  autoConnect: false, // Prevents aggressive connection attempts prior to server discovery on mobile
});

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
