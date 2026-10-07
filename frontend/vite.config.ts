import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import fs from 'fs'

// Monaco's ESM vendors its own DOMPurify (esm/vs/base/browser/dompurify/dompurify.js, imported by
// domSanitize.js as './dompurify/dompurify.js'), so package.json's dompurify override alone changes
// only node_modules/dompurify, which nothing runs (#35). This sends that import to the dompurify
// package: in the build (resolveId) and in dev's pre-bundling (esbuild). The build fails if the import
// was never seen, so a monaco update that moves the file can't quietly bring its own copy back;
// scripts/check-bundle.mjs checks the version that ends up in dist.
const MONACO_PURIFY = { source: './dompurify/dompurify.js', importer: /monaco-editor[\\/]esm[\\/]vs[\\/]base[\\/]browser[\\/]/ }
const PURIFY = path.resolve(__dirname, 'node_modules/dompurify/dist/purify.es.mjs')
function monacoDompurify(): Plugin {
  let redirected = false
  return {
    name: 'monaco-dompurify',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source !== MONACO_PURIFY.source || !importer || !MONACO_PURIFY.importer.test(importer)) return null
      redirected = true
      return PURIFY
    },
    buildEnd(error) {
      if (!error && !redirected) {
        this.error(`no import of ${MONACO_PURIFY.source} from monaco-editor's base/browser: ` +
          'monaco moved its DOMPurify; redirect the new path to the dompurify package (vite.config.ts)')
      }
    },
  }
}

// @monaco-editor/loader (under @monaco-editor/react) keeps a default Monaco on cdn.jsdelivr.net
// (lib/*/config/index.js: paths.vs), which it fetches unless it is handed one. monaco.ts hands it the
// bundled Monaco (loader.config({ monaco })), and that one line is all that keeps the editor off the
// CDN: drop it and everything is still bundled, so check-bundle would see nothing wrong, and the editor
// would quietly load jsdelivr's Monaco online and «Φόρτωση…» forever offline (#35). So the default goes
// too: every jsdelivr URL in the loader becomes this local path, which nothing serves. Without the
// loader.config line the editor then never loads, online or not, in dev and in the build, and
// scripts/check-bundle.mjs fails on any jsdelivr URL left in dist, the loader's included.
const MONACO_LOADER = /@monaco-editor[\\/]loader[\\/]/
const NO_CDN = { url: /https:\/\/cdn\.jsdelivr\.net\/npm\/monaco-editor@[^'"`]+/g, path: '/monaco-is-bundled-see-monaco.ts' }
const noLoaderCdn = (code: string) => code.replace(NO_CDN.url, NO_CDN.path)
function monacoLoaderNoCdn(): Plugin {
  return {
    name: 'monaco-loader-no-cdn',
    apply: 'build',
    transform(code, id) {
      if (!MONACO_LOADER.test(id) || !code.includes('cdn.jsdelivr.net')) return null
      return { code: noLoaderCdn(code), map: null }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared')
    }
  },
  plugins: [
    monacoDompurify(),
    monacoLoaderNoCdn(),
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
    esbuildOptions: {
      plugins: [{
        name: 'monaco-dompurify',
        setup(build) {
          build.onResolve({ filter: /^\.\/dompurify\/dompurify\.js$/ },
            args => (MONACO_PURIFY.importer.test(args.importer) ? { path: PURIFY } : undefined))
        },
      }, {
        name: 'monaco-loader-no-cdn',
        setup(build) {
          build.onLoad({ filter: /@monaco-editor[\\/]loader[\\/].*\.js$/ }, async args => {
            const code = await fs.promises.readFile(args.path, 'utf8')
            return code.includes('cdn.jsdelivr.net') ? { contents: noLoaderCdn(code), loader: 'js' } : undefined
          })
        },
      }],
    },
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
