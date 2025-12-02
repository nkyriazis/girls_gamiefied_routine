FROM node:20-alpine AS builder
WORKDIR /app
COPY shared/ ./shared/
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm ci --prefer-offline --no-audit
COPY backend/ .
RUN npm run build
# Copy sdk-proxy.js to dist (it's a plain JS file, not TypeScript, so it's not compiled)
RUN cp src/sdk-proxy.js dist/backend/src/

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit
COPY --from=builder /app/backend/dist ./dist
# Create symlink so sdk-proxy.js can find node_modules via relative path (../node_modules)
RUN ln -s /app/node_modules /app/dist/backend/node_modules
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