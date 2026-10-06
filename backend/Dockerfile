FROM node:24-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --prefer-offline --no-audit
COPY backend/ .
RUN npm run build

# Node 24 LTS: ships the built-in node:sqlite driver (no native modules to build)
FROM node:24-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit
COPY --from=builder /app/backend/dist ./dist
COPY backend/data.json ./
COPY backend/data.schema.json backend/exercises.schema.json backend/state.schema.json backend/exercise-pool.schema.json ./
# The daily exercise pools ship with the image (new content arrives with an update)
COPY backend/exercise-pools ./exercise-pools
# Config, the database (routine.db) and legacy state files live on the /data volume
# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown node:node uploads
EXPOSE 3000
CMD ["npm", "start"]