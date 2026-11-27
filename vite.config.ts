import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

const THEME = '#059669';
const BG = '#0B1512';

// Single source of truth for the production CSP: public/_headers. `vite preview` enforces it too.
const PROD_CSP = /Content-Security-Policy:\s*(.+)/.exec(readFileSync('public/_headers', 'utf8'))![1].trim();

// Dev-only CSP so any accidental network call fails loudly while developing.
// (Vite dev needs inline styles + its HMR websocket; production CSP lives in public/_headers.)
const devCsp = (): Plugin => ({
  name: 'dev-csp',
  apply: 'serve',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: {
        'http-equiv': 'Content-Security-Policy',
        content:
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; worker-src 'self'; manifest-src 'self'; object-src 'none'",
      },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig({
  build: { chunkSizeWarningLimit: 600 }, // the big chunk is pdf.js, loaded lazily on the Import screen
  preview: { headers: { 'Content-Security-Policy': PROD_CSP } },
  plugins: [
    devCsp(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeManifestIcons: false, // globPatterns already precaches them (plugin adds the manifest itself)
      manifest: {
        name: 'Duit Check',
        short_name: 'Duit Check',
        description: 'Parse statement bank, tengok duit lari mana, kira zakat. Offline, data dalam phone je.',
        lang: 'ms',
        display: 'standalone',
        start_url: './',
        scope: './',
        theme_color: THEME,
        background_color: BG,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,json,woff,woff2}'],
        // pdf.js worker is ~1MB+; it must be precached so PDF parsing works offline.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
