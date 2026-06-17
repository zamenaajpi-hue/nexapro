export function isNativeCapacitorApp(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean((window as any).Capacitor?.isNativePlatform?.());
}

export function getNativePlatform(): string | null {
  if (typeof window === 'undefined') return null;
  return (window as any).Capacitor?.getPlatform?.() || null;
}

export function isNativeAndroidApp(): boolean {
  return isNativeCapacitorApp() && getNativePlatform() === 'android';
}
