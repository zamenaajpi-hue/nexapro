/**
 * API and Network resolution utilities for Nexa Messenger
 * Supports seamless Web, Electron, and Android/Capacitor environments.
 */

import { readStoredServerUrl } from './serverUrl';

export function getBaseUrl(): string {
  // On standard browsers we default to relative paths to the current origin.
  // We only use the explicitly configured server URL on mobile/Capacitor where origins are tricky.
  if (isMobileOrCapacitor()) {
    const savedUrl = readStoredServerUrl();
    if (savedUrl) {
      return savedUrl;
    }
  }
  
  return "";
}

export function resolveApiUrl(path: string): string {
  const base = getBaseUrl();
  const cleanPath = path.startsWith('/') ? path : '/' + path;
  return base + cleanPath;
}

export function isMobileOrCapacitor(): boolean {
  // Only return true if actually running natively in Capacitor or Electron, 
  // not just a mobile web browser hitting the deployed URL.
  return (
    (window as any).Capacitor !== undefined ||
    ((window as any).process && (window as any).process.type === 'renderer') ||
    (window.location.protocol === 'file:')
  );
}
