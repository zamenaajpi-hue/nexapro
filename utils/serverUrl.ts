const PRIMARY_STORAGE_KEY = 'nexa_server_url';
const LEGACY_STORAGE_KEY = 'SERVER_URL';

const cleanUrl = (url: string): string => url.trim().replace(/\/$/, '');

export const readStoredServerUrl = (): string => {
  if (typeof window === 'undefined') return '';

  try {
    const primary = localStorage.getItem(PRIMARY_STORAGE_KEY);
    if (primary) return cleanUrl(primary);

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) return cleanUrl(legacy);

    const sessionPrimary = sessionStorage.getItem(PRIMARY_STORAGE_KEY);
    if (sessionPrimary) return cleanUrl(sessionPrimary);

    const sessionLegacy = sessionStorage.getItem(LEGACY_STORAGE_KEY);
    if (sessionLegacy) return cleanUrl(sessionLegacy);
  } catch {
    // Ignore storage access issues and fall back to an empty URL.
  }

  return '';
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

