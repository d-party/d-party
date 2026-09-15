# syntax=docker/dockerfile:1

# d-party frontend — Next.js (standalone output) served by a Node runtime.
# Build:  docker build -t d-party-frontend .
# Run:    docker run -p 3000:3000 d-party-frontend

FROM node:26-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# node:26-alpine 以降、corepack はイメージに同梱されなくなった（node:24-alpine
# までは /usr/local/bin/corepack がある）。npm から入れて有効化することで、
# pnpm のバージョンは package.json の packageManager 一箇所のままにできる。
RUN npm install --global corepack@latest && corepack enable

# --- Dependencies -----------------------------------------------------------
FROM base AS deps
WORKDIR /app
# pnpm-workspace.yaml も要る。pnpm 10.28 以降は overrides / onlyBuiltDependencies
# がここに置かれ、欠けると --frozen-lockfile が
# ERR_PNPM_LOCKFILE_CONFIG_MISMATCH で落ちる。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- Build ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Backend connection is baked in at build time via NEXT_PUBLIC_* (see env.ts).
ARG NEXT_PUBLIC_BACKEND_HOST
ARG NEXT_PUBLIC_BACKEND_PROTOCOL
ARG NEXT_PUBLIC_WEBSOCKET_PROTOCOL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# --- Runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
