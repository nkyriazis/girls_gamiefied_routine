FROM node:20-alpine AS builder
WORKDIR /app
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install
COPY backend/ .
COPY shared/ ../shared/
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm install --production
COPY --from=builder /app/backend/dist ./dist
COPY backend/data.json ./
# state.json will be mounted
EXPOSE 3000
CMD ["npm", "start"]