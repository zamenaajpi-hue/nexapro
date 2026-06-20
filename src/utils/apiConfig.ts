/**
 * API Configuration Manager
 * Handles server URL configuration for mobile and web platforms
 */

import { DEFAULT_SERVER_URL, readStoredServerUrl, saveStoredServerUrl } from './serverUrl';
import { fetchHealthCheck } from './nativeHttp';

const isElectron = () => {
  return !!(window as any).electron?.ipcRenderer;
};

const isMobile = () => {
  return !!(window as any).Capacitor;
};

let serverUrl = '';

/**
 * Initialize server URL from storage or use default
 */
export const initializeServerUrl = async (): Promise<string> => {
  // Check if URL is already set
  if (serverUrl) return serverUrl;

  const saved = readStoredServerUrl();

  if (saved) {
    serverUrl = saved;
    console.log('[API] Using saved server URL:', serverUrl);
    return serverUrl;
  }

  // For development, use localhost
  if (!isMobile() && !isElectron()) {
    serverUrl = 'http://localhost:3000';
    console.log('[API] Using development URL:', serverUrl);
    return serverUrl;
  }

  serverUrl = DEFAULT_SERVER_URL;
  console.log('[API] Using default production URL:', serverUrl);
  return serverUrl;
};

/**
 * Get current server URL
 */
export const getServerUrl = (): string => {
  return serverUrl;
};

/**
 * Set server URL (typically called after user configures it)
 */
export const setServerUrl = (url: string): void => {
  serverUrl = saveStoredServerUrl(url);
  console.log('[API] Server URL set to:', serverUrl);
};

/**
 * Check if server URL is configured
 */
export const isServerConfigured = (): boolean => {
  return !!getServerUrl();
};

/**
 * Check if we need to show server config modal
 */
export const shouldShowServerConfig = (): boolean => {
  return isMobile() && !isServerConfigured();
};

/**
 * Get API base URL for fetch requests
 */
export const getApiBase = (): string => {
  const url = getServerUrl();
  if (!url) {
    console.warn('[API] No server URL configured, using default production URL');
    return DEFAULT_SERVER_URL;
  }
  return url;
};

/**
 * Get Socket.io server URL
 */
export const getSocketUrl = (): string => {
  return getApiBase();
};

/**
 * Build full API endpoint URL
 */
export const buildApiUrl = (endpoint: string): string => {
  const base = getApiBase();
  return `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

/**
 * Test connection to server
 */
export const testServerConnection = async (url: string): Promise<boolean> => {
  try {
    const response = await fetchHealthCheck(url, 5000);
    return response.ok;
  } catch (err) {
    console.warn('[API] Connection test failed:', err);
    return false;
  }
};

export default {
  initializeServerUrl,
  getServerUrl,
  setServerUrl,
  isServerConfigured,
  shouldShowServerConfig,
  getApiBase,
  getSocketUrl,
  buildApiUrl,
  testServerConnection,
};
