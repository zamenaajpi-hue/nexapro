const PRIMARY_STORAGE_KEY = 'nexa_server_url';
const LEGACY_STORAGE_KEY = 'SERVER_URL';
export const DEFAULT_SERVER_URL = 'http://64.188.67.71:3000';

const cleanUrl = (url: string): string => url.trim().replace(/\/$/, '');

const readServerUrlFromLocation = (): string | null => {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const queryUrl = params.get('serverUrl') || params.get('server_url');
    return queryUrl ? cleanUrl(queryUrl) : null;
  } catch {
    return null;
  }
};

export const readStoredServerUrl = (): string => {
  if (typeof window === 'undefined') return DEFAULT_SERVER_URL;

  try {
    const locationUrl = readServerUrlFromLocation();
    if (locationUrl) return locationUrl;

    const primary = localStorage.getItem(PRIMARY_STORAGE_KEY);
    if (primary) return cleanUrl(primary);

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return cleanUrl(legacy);

    const sessionPrimary = sessionStorage.getItem(PRIMARY_STORAGE_KEY);
    if (sessionPrimary) return cleanUrl(sessionPrimary);

    const sessionLegacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (sessionLegacy) return cleanUrl(sessionLegacy);
  } catch {
    // Ignore storage access issues and fall back to the production server.
  }

  return DEFAULT_SERVER_URL;
};

export const saveStoredServerUrl = (url: string): string => {
  const normalized = cleanUrl(url);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PRIMARY_STORAGE_KEY, normalized);
      localStorage.setItem(LEGACY_STORAGE_KEY, normalized);
      sessionStorage.setItem(PRIMARY_STORAGE_KEY, normalized);
      sessionStorage.setItem(LEGACY_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage write failures; callers can still use the returned URL.
    }
  }

  return normalized;
};
