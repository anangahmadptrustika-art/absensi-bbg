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

# Folder data (database SQLite + foto selfie) — pasang volume ke sini.
# Saat start, kepemilikan folder data hasil bind-mount dibereskan dulu
# (folder buatan host biasanya milik root → user 'node' tidak bisa menulis
# database, menyebabkan semua login gagal), lalu aplikasi dijalankan
# sebagai user 'node' (bukan root).
RUN mkdir -p /app/data && chown -R node:node /app
VOLUME /app/data

EXPOSE 3000
CMD ["/bin/sh", "-c", "chown -R node:node /app/data && if command -v setpriv >/dev/null 2>&1; then exec setpriv --reuid=node --regid=node --init-groups node server.js; elif command -v runuser >/dev/null 2>&1; then exec runuser -u node -- node server.js; else exec node server.js; fi"]
