# syntax=docker/dockerfile:1

# d-party frontend — Next.js (standalone output) served by a Node runtime.
#
# ビルドコンテキストは **リポジトリのルート**（frontend/ ではない）。pnpm workspace の
# ロックファイルがルートにあり、frontend 単体のコンテキストでは
# --frozen-lockfile を満たせないため。
#
# Build:  docker build -f frontend/Dockerfile -t d-party-frontend .
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
# workspace の manifest 一式を先に置く。extension/package.json も要る:
# 欠けると pnpm-workspace.yaml の glob が外れ、ロックファイルの importers と
# 食い違って --frozen-lockfile が ERR_PNPM_OUTDATED_LOCKFILE で落ちる。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
COPY extension/package.json extension/
# frontend とその依存だけを入れる（extension の storybook 等は入れない）。
RUN pnpm install --frozen-lockfile --filter d-party-frontend...

# --- Build ------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend frontend
# Backend connection is baked in at build time via NEXT_PUBLIC_* (see env.ts).
ARG NEXT_PUBLIC_BACKEND_HOST
ARG NEXT_PUBLIC_BACKEND_PROTOCOL
ARG NEXT_PUBLIC_WEBSOCKET_PROTOCOL
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/frontend
RUN pnpm build

# --- Runtime ----------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next は「ロックファイルのある位置」を outputFileTracingRoot とみなす。
# ここでは workspace のルートなので、standalone の中身は
#   standalone/node_modules/…  +  standalone/frontend/server.js
# という workspace の形になる。展開先もその形に合わせる。
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
# public/ は standalone に丸ごとは入らない（参照されたファイルだけ traced される）。
COPY --from=builder /app/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "frontend/server.js"]
