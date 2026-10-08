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

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]