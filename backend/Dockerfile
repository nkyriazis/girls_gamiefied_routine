FROM node:24-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --prefer-offline --no-audit
COPY backend/ .
RUN npm run build
# Copy sdk-proxy.js to dist (it's a plain JS file, not TypeScript, so it's not compiled)
RUN cp src/sdk-proxy.js dist/backend/src/

# Node 24 LTS: ships the built-in node:sqlite driver (no native modules to build)
FROM node:24-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit
COPY --from=builder /app/backend/dist ./dist
# Create symlink so sdk-proxy.js can find node_modules via relative path (../node_modules)
RUN ln -s /app/node_modules /app/dist/backend/node_modules
COPY backend/data.json ./
COPY backend/data.schema.json backend/exercises.schema.json backend/state.schema.json ./
# Config, the database (routine.db) and legacy state files live on the /data volume
# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown node:node uploads
EXPOSE 3000
CMD ["npm", "start"]