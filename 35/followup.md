# Follow-up issues from #35 (texts to open; the owner said yes to opening them separately)

---

## 1. nginx: gzip what the Pi sends

**Title:** The Pi's nginx sends the app uncompressed: turn on gzip for JS, CSS, JSON and SVG

`frontend/nginx.conf` has no `gzip` directives, and nginx:alpine's own `/etc/nginx/nginx.conf` leaves it off (`#gzip  on;`). So every device gets the app's JavaScript raw over the home LAN:

| file | raw | gzip |
|---|---|---|
| kids' entry `assets/index-*.js` | 687.6 kB | 204.9 kB |
| Monaco, `assets/JsonEditor-*.js` (#35, the first time a JSON panel opens) | 3,981.9 kB | 1,032.9 kB |
| `assets/JsonEditor-*.css` | 186.5 kB | 27.7 kB |

(vite build's own gzip column, #35's bundle-sizes-after.txt.) The kiosk precaches once per release, so it matters most for a phone on weak Wi-Fi opening Προχωρημένα, and for each release's precache download.

**Fix:** in `nginx.conf`, `gzip on; gzip_types application/javascript text/css application/json image/svg+xml application/manifest+json; gzip_min_length 1024;` (and `gzip_vary on`). Optionally `gzip_static on` with precompressed `.gz` files from the build. Check: `curl -sI -H 'Accept-Encoding: gzip' http://<pi>/assets/index-*.js` shows `Content-Encoding: gzip`; the service worker still precaches (it stores the decoded body). Don't compress the mp3/wav/png assets (already compressed).

---

## 2. Image build: build the frontend's static files natively, not under QEMU

**Title:** frontend/Dockerfile: run the builder stage on `$BUILDPLATFORM` (its output is the same static files for every arch)

`.github/workflows/docker-build.yml` builds `linux/amd64` and `linux/arm64` (lines 31-38, QEMU set up for arm64). `frontend/Dockerfile`'s builder stage is `FROM node:24-alpine AS builder` with no `--platform`, so for the arm64 image `npm ci` and `vite build` run emulated. Since #35 the build bundles Monaco (~2,440 modules; ~8 s natively against ~2 s before), and under QEMU that is several times slower. Its output, `dist/`, is static files, identical for both arches; only the nginx stage needs to be arm64.

**Fix:** `FROM --platform=$BUILDPLATFORM node:24-alpine AS builder` (BuildKit sets `BUILDPLATFORM`). Nothing in the builder produces arch-specific output (rollup/esbuild native binaries are only used at build time). Check: the release workflow's arm64 frontend job time before/after; the image's `/usr/share/nginx/html` is byte-identical between the two arches.

---

## 3. Google Fonts: the screens' font needs the internet

**Title:** Outfit comes from fonts.googleapis.com: bundle it so the screens look the same with no internet

`frontend/src/styles/global.css:1` imports `https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800`, and the CSS then loads woff2 files from `fonts.gstatic.com`. With the internet down (the home LAN up), a device that has neither in its cache shows the kids' and parent's screens in the fallback `sans-serif` (#35's offline recordings: the only request left that needs the internet is this one). The service worker's runtime cache (`vite.config.ts`, CacheFirst) matches only `fonts.googleapis.com`, not `fonts.gstatic.com`, so even a device that loaded the font online keeps the woff2 only in its HTTP cache.

**Fix:** ship Outfit (SIL Open Font License) with the app: the four weights as woff2 under `frontend/public/fonts/` (or `@fontsource/outfit` from npm), an `@font-face` per weight in global.css with `font-display: swap`, drop the googleapis import and its runtime-cache entry. woff2 is already in the precache's globPatterns, so the kiosk gets them on install. Check offline (a Playwright route that aborts every non-local request, as `.evidence/35/after.mjs` does): no request leaves the LAN, and the screens render in Outfit.
