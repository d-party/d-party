# syntax=docker/dockerfile:1

# ビルドコンテキストはリポジトリのルート（ロックファイルがルートにあるため）。
#   docker build -f frontend/Dockerfile -t d-party-frontend .

FROM node:26-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# node:26-alpine は corepack を同梱しない。pnpm の版は packageManager に従わせる。
RUN npm install --global corepack@latest && corepack enable

FROM base AS deps
WORKDIR /app
# extension/package.json も要る。欠けるとロックファイルの importers と合わず
# --frozen-lockfile が落ちる。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/
COPY extension/package.json extension/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile --filter d-party-frontend...

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# 共有 UI はソースのまま取り込み、transpilePackages で変換する。
COPY packages/ui packages/ui
COPY frontend frontend
ARG NEXT_PUBLIC_BACKEND_HOST
ARG NEXT_PUBLIC_BACKEND_PROTOCOL
ARG NEXT_PUBLIC_WEBSOCKET_PROTOCOL
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app/frontend
RUN pnpm build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# outputFileTracingRoot がワークスペースのルートになるので、standalone は
# node_modules/ + frontend/server.js の形になる。
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/frontend/.next/static ./frontend/.next/static
# public/ は standalone に丸ごとは入らない。

COPY --from=builder /app/frontend/public ./frontend/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "frontend/server.js"]
