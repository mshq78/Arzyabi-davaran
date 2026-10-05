import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSyncEngine } from './client/offline/syncEngine';
import { getStoredAuthToken } from './client/api';

// Service worker caches the app shell so the PWA opens offline (production builds only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // SW registration success
        })
        .catch((err) => {
          console.warn('ServiceWorker registration ignored:', err);
        });
    } catch (e) {
      console.warn('ServiceWorker registration threw:', e);
    }
  });
}

// Start background sync listeners
initSyncEngine(getStoredAuthToken);

createRoot(document.getElementById('root')!).render(<App />);

