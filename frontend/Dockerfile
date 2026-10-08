FROM node:24-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm ci --prefer-offline --no-audit
COPY frontend/ .
RUN npm run build
# The .gz nginx's gzip_static serves (nginx.conf, #100): scripts and styles over 1 kB in assets/, the originals
# kept for clients without gzip. Not sw.js or workbox-*.js: they stay exactly as Workbox wrote them.
RUN find dist/assets -type f \( -name '*.js' -o -name '*.css' -o -name '*.svg' -o -name '*.json' -o -name '*.html' \) -size +1k -exec gzip -9 -k -n {} +

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]