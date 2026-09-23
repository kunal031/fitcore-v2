# ── Build stage ───────────────────────────────────────────────────────────────
# Compiles TypeScript with the dev dependencies present, which the runtime
# image then does not have to carry.
FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Run unprivileged; the node image ships a suitable user.
USER node

EXPOSE 8000

CMD ["node", "dist/server.js"]
