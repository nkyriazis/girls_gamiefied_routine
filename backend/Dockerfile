FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --prefer-offline --no-audit
COPY backend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit
COPY --from=builder /app/backend/dist ./dist
COPY backend/data.json ./
COPY backend/data.schema.json ./
COPY backend/state.schema.json ./
# Copy schemas to dist directory for admin endpoints
COPY backend/data.schema.json ./dist/backend/
COPY backend/state.schema.json ./dist/backend/
# state.json will be mounted
# Create uploads directory with proper permissions
RUN mkdir -p uploads && chown node:node uploads
EXPOSE 3000
CMD ["npm", "start"]