/// <reference types="vite/client" />
// Suppress benign WebSocket connection errors/rejections from Vite HMR/dev environment.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const errorMsg = event.reason?.message || String(event.reason);
    if (
      errorMsg.includes('WebSocket') ||
      errorMsg.includes('websocket') ||
      errorMsg.includes('failed to connect to websocket') ||
      errorMsg.includes('WebSocket closed without opened')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('error', (event) => {
    const errorMsg = event.message || '';
    if (
      errorMsg.includes('WebSocket') ||
      errorMsg.includes('websocket') ||
      errorMsg.includes('failed to connect to websocket') ||
      errorMsg.includes('WebSocket closed without opened')
    ) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { isNativeAndroidApp, isNativeCapacitorApp } from './utils/platform';

const isElectronRenderer = typeof window !== 'undefined' && Boolean((window as any).electron?.isElectron);

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element with id="root" not found in DOM');
  }

  document.documentElement.classList.toggle('platform-native', isNativeCapacitorApp());
  document.documentElement.classList.toggle('platform-android', isNativeAndroidApp());
  const Router = isElectronRenderer ? HashRouter : BrowserRouter;

  createRoot(rootElement).render(
    <StrictMode>
      <Router>
        <App />
      </Router>
    </StrictMode>,
  );
} catch (error) {
  console.error('[INIT ERROR]', error);
}

const isNativeApp = typeof window !== 'undefined' && isNativeCapacitorApp();

if ('serviceWorker' in navigator && !isElectronRenderer && !isNativeApp) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('SW registration failed: ', err);
      });
    });
  } else {
    // Unregister in dev to avoid aggressive caching issues.
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

if ('serviceWorker' in navigator && isNativeApp) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (const registration of registrations) {
      registration.unregister();
    }
  }).catch(() => {});
}
