import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared')
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      workbox: {
        // mp3: the owl's voice (public/help-voice), wav: the screens' sounds (public/sfx), there before she needs them
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,mp3,wav}'],
        // Monaco (the parent's JSON editors, ~5 MB, #35) comes from the Pi when a JSON panel opens, not on
        // every device's install: the kiosk never opens it, and saving needs the Pi anyway. Its chunks are
        // named after JsonEditor (lazy in AdvancedView); scripts/check-bundle.mjs fails the build if one
        // gets precached, or reaches the kids' entry. Don't give Monaco a manualChunks entry: it pulled
        // react into the Monaco chunk, so the kids' entry imported all of it.
        globIgnores: ['**/assets/JsonEditor-*', '**/assets/jsonMode-*', '**/assets/*.worker-*'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              }
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5 // 5 minutes
              }
            }
          }
        ]
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo.svg'],
      manifest: {
        name: 'Girls Gamified Routine',
        short_name: 'Routine',
        description: 'Gamified daily routines for kids',
        theme_color: '#4cc9f0',
        background_color: '#1a1a2e',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        categories: ['lifestyle', 'productivity', 'education'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  // Dev: pre-bundle Monaco's entries (monaco.ts) at startup, so the first JSON panel opened doesn't
  // make Vite discover them and reload the page
  optimizeDeps: {
    include: ['@monaco-editor/react', 'monaco-editor/editor/editor.api', 'monaco-editor/features/register.all',
      'monaco-editor/languages/features/json/register'],
  },
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    // shared/ sits next to the app (mounted at /shared in the dev container): let Vite serve it
    fs: { allow: [__dirname, path.resolve(__dirname, '../shared')] },
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: process.env.WS_URL || 'ws://localhost:3000',
        ws: true,
      },
      '/uploads': {
        target: process.env.API_URL || 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
