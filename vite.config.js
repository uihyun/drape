import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'

// Single source of truth for the app version (shown in the welcome footer)
// — read from package.json so it never drifts from the published version.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)))

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // The static manifest in /public/manifest.json is the source of truth.
      // Tell the plugin not to generate / inject its own manifest tag — keeps
      // our existing icons/shortcuts setup intact.
      manifest: false,
      // Don't auto-inject the service worker registration. We register it
      // manually in main.jsx, gated on isNativeApp() so the Capacitor build
      // doesn't run the PWA cache layer (which doesn't make sense inside a
      // native app and was tripping over the capacitor:// origin).
      injectRegister: null,
      workbox: {
        // Pre-cache built JS/CSS/HTML so repeat visits skip the network on
        // app shell. Cap to ~5MB so large source maps don't bloat the SW.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // 새 SW 즉시 활성화 + 옛 client 들 takeover. 사용자가 탭 닫고 재오픈
        // 안 해도 새 cache 정책 적용. 이전 SW 가 활성 상태로 옛 cache 서비스하던
        // 문제 (opaque mismatch) 해결의 핵심.
        skipWaiting: true,
        clientsClaim: true,
        // 이전 workbox precache 캐시 자동 삭제.
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Firebase Storage (generated + original images). Cache-first for
            // 7 days. cacheName 을 v2 로 bump — 옛 'voda-images' cache 의 opaque
            // 엔트리 모두 polled out 시키고 새 캐시에 status 200 (CORS) 만 누적.
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'drape-images-v1',
              expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Google Fonts CSS — short-lived but still worth caching.
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'drape-fonts-css' },
          },
          {
            // Google Fonts files (Material Icons font binary).
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'drape-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Don't claim Firestore / Cloud Functions traffic — those have their
        // own auth + idempotency model. Default fallback is network-only.
        // Also exclude /.well-known/ so Apple / Google universal-link
        // validators get the raw JSON, not the SPA shell.
        navigateFallbackDenylist: [
          /^\/__\//, // Firebase reserved
          /^\/\.well-known\//,
          /^\/.*googleapis\.com/,
        ],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Split the bundle so the initial JS load isn't a single ~1MB blob.
        // Vendor chunks change rarely → users hit the SW cache more often.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase': [
            'firebase/app',
            'firebase/auth',
            'firebase/firestore',
            'firebase/storage',
            'firebase/analytics',
            'firebase/functions',
          ],
          'react-markdown': ['react-markdown'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
