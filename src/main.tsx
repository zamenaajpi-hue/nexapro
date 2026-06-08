/// <reference types="vite/client" />
// Suppress benign WebSocket connection errors/rejections from Vite HMR/dev environment
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
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

// Show status on screen immediately
const showStatus = (msg: string, color: string = 'blue') => {
  const statusDiv = document.getElementById('status') || document.createElement('div');
  statusDiv.id = 'status';
  statusDiv.style.cssText = `position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;padding:20px;font-family:monospace;white-space:pre-wrap;color:${color};background:#000;overflow:auto;font-size:14px;`;
  statusDiv.textContent = msg;
  document.body.appendChild(statusDiv);
  console.log(msg);
};

showStatus('🔧 Initializing app...');

try {
  showStatus('📍 Finding root element...');
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element with id="root" not found in DOM');
  }
  showStatus('✅ Root element found\n📦 Starting React mount...');
  
  createRoot(rootElement).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
  
  showStatus('✨ React mounted - removing status overlay', 'green');
  setTimeout(() => {
    const statusDiv = document.getElementById('status');
    if (statusDiv) statusDiv.remove();
  }, 2000);
} catch (error: any) {
  const errorMsg = error?.stack || String(error) || 'Unknown error';
  showStatus(`❌ INIT ERROR:\n\n${errorMsg}`, 'red');
  console.error('[INIT ERROR]', error);
}

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => {
        console.error('SW registration failed: ', err);
      });
    });
  } else {
    // Unregister in dev to avoid aggressive caching issues
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.unregister();
      }
    });
  }
}
