# Multi-Arch Dockerfile (ARM64, ARMv7, AMD64/x86_64)
# M6.3: Nicht-root-Laufzeit, HEALTHCHECK und keine devDependencies im
# Runner-Image. Zusammen mit .dockerignore bleibt .env / dev.db und die
# lokale Altlast-Sammlung ausserhalb des Build-Kontextes.
FROM node:20-alpine AS base

WORKDIR /app
RUN apk add --no-cache openssl libc6-compat curl

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Produktion-Abhaengigkeiten ohne devDependencies (TypeScript, Vitest etc.)
FROM base AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# M6.3: Container-Prozess NICHT als root laufen lassen (node-User existiert im Basis-Image)
USER node

COPY --from=proddeps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/prisma ./prisma
COPY --from=builder --chown=node:node /app/server.js ./server.js
COPY --from=builder --chown=node:node /app/next.config.mjs ./next.config.mjs
COPY --from=builder --chown=node:node /app/scripts ./scripts

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "server.js"]
