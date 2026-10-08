# The builder runs on the build machine's own platform even for the arm64 image: its output, dist/,
# is the same static files for every arch, and under QEMU npm ci + vite build (Monaco, #35) are
# several times slower (#101). Only the nginx stage below is per-arch, and it runs nothing.
FROM --platform=$BUILDPLATFORM node:24-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --prefer-offline --no-audit
COPY frontend/ .
RUN npm run build
# The .gz nginx's gzip_static serves (nginx.conf, #100): what dist/assets holds over 1 kB, its scripts, styles
# and Monaco's codicon .ttf (nginx:alpine sends ttf as octet-stream, which gzip_types never reaches; gzip_static
# serves a .gz whatever the type), the originals kept for clients without gzip. Not sw.js or workbox-*.js in the
# root: they stay exactly as Workbox wrote them.
RUN find dist/assets -type f \( -name '*.js' -o -name '*.css' -o -name '*.ttf' \) -size +1k -exec gzip -9 -k -n {} +

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]