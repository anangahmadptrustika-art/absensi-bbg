# ===== Tahap 1: build =====
FROM node:22-bookworm-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ===== Tahap 2: runtime ramping =====
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATA_DIR=/app/data

# hasil build standalone sudah berisi node_modules yang diperlukan
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# folder data (database SQLite + foto selfie) — pasang volume ke sini
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME /app/data

EXPOSE 3000
CMD ["node", "server.js"]
