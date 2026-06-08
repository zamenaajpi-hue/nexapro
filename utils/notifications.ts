export type NotificationType = 'success' | 'error' | 'warning';

export function notifyApp(message: string, type: NotificationType = 'error') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('nexa:notify', {
    detail: { message, type },
  }));
}
