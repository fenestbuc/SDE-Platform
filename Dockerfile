FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Copy server code
COPY . .

# Build client
WORKDIR /app/src/client
RUN npm ci
RUN npm run build

# Build server
WORKDIR /app
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/client/dist ./src/client/dist
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "start"]
