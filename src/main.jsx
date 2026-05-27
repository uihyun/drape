import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { LocaleProvider } from './hooks/useLocale.jsx'
import { AIService } from './services/ai-service.js'
import { isNativeApp } from './services/platform-service.js'

// PWA service worker — web only. Inside the Capacitor native app the SW
// caching layer is redundant and conflicts with the capacitor:// origin.
if (!isNativeApp() && 'serviceWorker' in navigator) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {/* PWA disabled — ignore */});

  // One-time sweep of voda-era runtime caches. Safe to remove a few months
  // after launch when nobody has the old cache anymore.
  if ('caches' in window) {
    caches.delete('voda-images').catch(() => {});
    caches.delete('voda-images-v2').catch(() => {});
  }
}

// Native app: marker class + status-bar overlay so the webview fills the
// screen and CSS handles the safe-area inset.
if (isNativeApp()) {
  document.documentElement.classList.add('is-native');
  document.body && document.body.classList.add('is-native');
  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('is-native');
  }, { once: true });

  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  }).catch(() => {/* plugin missing — ignore */});
}

// Wait for Material Icons font before unhiding icons to avoid the FOIT.
if (document.fonts && document.fonts.load) {
  document.fonts.load('1em "Material Icons"').then(() => {
    document.body.classList.add('icons-ready');
  }).catch(() => {
    document.body.classList.add('icons-ready');
  });
  setTimeout(() => document.body.classList.add('icons-ready'), 1500);
} else {
  document.body.classList.add('icons-ready');
}

window.onerror = (message, source, lineno, colno, error) => {
  AIService.logError(error || new Error(String(message)), {
    source, lineno, colno, type: 'uncaught',
  });
};

window.onunhandledrejection = (event) => {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
  AIService.logError(error, { type: 'unhandled_rejection' });
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </React.StrictMode>,
)
