# AGENTS.md — d-party

このリポジトリで作業する AI エージェント・開発者向けのガイドです。

## What this is

`d-party` は **dアニメストアでの「同時視聴」** を提供するサービスです。
このリポジトリは複数の Git サブモジュールを束ねた **疑似 monorepo** であり、
各サービスを 1 か所からクローン・開発できるようにまとめたものです。

**重要:** このリポジトリ自身が管理するのは「サブモジュールの参照（コミット SHA）」と
「開発環境の設定ファイル」だけです。サービスの実装コードは各サブモジュール内にあり、
それぞれが独立したリポジトリです。

## Architecture（サブモジュール構成）

| パス                | サービス            | スタック                                                            | 上流リポジトリ                                                                    |
| ------------------- | ------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `backend/`          | Django バックエンド | Python 3.13 · Django 5 · Channels · DRF · PostgreSQL 16 · Redis 7 · Nginx | [backend](https://github.com/d-party/backend)                     |
| `chrome-extension/` | Chrome 拡張機能     | Manifest V3 · Vanilla JS · jQuery 3.6                               | [chrome-extension](https://github.com/d-party/chrome-extension) |
| `frontend/`         | ユーザー向けフロントエンド | Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · pnpm | [frontend](https://github.com/d-party/frontend)                   |

各サブモジュールとも `main` ブランチを追跡（`.gitmodules`）。

### Request / data flow

```
Chrome 拡張機能 (dアニメストアのページに content script を注入)
        │  WebSocket (wss://d-party.net, 既定)
        ▼
Nginx :80/443 ──▶ Django (daphne/uvicorn, Channels)
        ├─ REST API (DRF)            : /api/*
        ├─ WebSocket (Channels)      : 同時視聴の同期
        └─ 管理画面 (Jazzmin)        : /admin/*
Django ──▶ PostgreSQL 16（永続化） / Redis 7（Channels レイヤ・キャッシュ）
監視: Prometheus + Grafana + cadvisor + node-exporter（django-prometheus 経由）
```

## Orchestration（docker-compose はこのルートにある）

サービスのオーケストレーションと各サービスの設定は **このモノレポのルート**が持つ:

```
d-party/                  ← このリポジトリ（ルート）
  docker-compose.yml      nginx · django · frontend · postgres · redis · adminer · prometheus · grafana · cadvisor · node-exporter
  .env.global             共有 env（ドメイン・Postgres 認証情報・DEBUG・各 upstream）
  nginx/ postgres/ redis/ prometheus/ grafana/   各サービス設定（runtime data は gitignore）
  backend/  frontend/  chrome-extension/          サブモジュール
```

- django は `build.context: ./backend`、frontend は `./frontend` をビルドコンテキストにする。
- 監視系（prometheus/grafana/cadvisor/node-exporter）は compose の `metrics` profile。
  起動は `docker compose --profile metrics up -d`。

## backend/（Django）

```
backend/                  ← リポジトリ直下が django プロジェクト（サブモジュール = d-party Backend）
  d_party/                プロジェクト設定 (settings.py, asgi.py, urls.py)
  streamer/               同時視聴の WebSocket consumers / cron / models
  api/                    DRF REST API (views, urls)
  web/                    管理者向け統計チャートのテンプレート
  pyproject.toml          uv 依存定義
  uv.lock
  Dockerfile              python:3.13-slim + uv
```

- 依存管理は **uv**（`backend/pyproject.toml`）。インフラ設定は backend には無く、ルートが持つ。
- WebSocket は **Django Channels** + `channels-redis` + `djangochannelsrestframework`、ASGI サーバは daphne/uvicorn。
- テストは **pytest**（`pytest-django`, `pytest-asyncio`, `factory-boy`, `pytest-cov`）。
- フォーマッタは **black**（`target-version = py310`）。
- CI（上流リポジトリ側）: autoblack · code-quality · pytest · security · license-check · release。

## chrome-extension/（Chrome 拡張機能）

```
chrome-extension/
  manifest.json           Manifest V3（service_worker, content_scripts）
  js/
    background.js         service worker
    common/settings.js    接続先バックエンド等の設定を集約
    library/              jQuery / Flickity / Font Awesome 等のサードパーティ
    d-animestore/         dアニメストア各画面の content script
    d-party/              d-party.net 側の content script
  css/ html/ icon/ images/ assets/
```

- ビルドツールは不使用（Vanilla JS + jQuery 3.6）。`chrome://extensions` で
  「パッケージ化されていない拡張機能を読み込む」でそのまま読み込める。
- 接続先は `js/common/settings.js` の `D_PARTY_BACKEND_HOST` /
  `D_PARTY_BACKEND_PROTOCOL` / `D_PARTY_WEBSOCKET_PROTOCOL` で変更する（既定 `wss://d-party.net`）。
- 対象サイト: `https://anime.dmkt-sp.jp/animestore/*` および `https://d-party.net/anime-store/lobby/*`。
- CI（上流リポジトリ側）: codeql-analysis · release。

## frontend/（Next.js）

```
frontend/
  src/
    app/                 App Router（layout / page / usage / anime-store/lobby/[roomId] / not-found）
    components/ui/        shadcn コンポーネント（chrome-extension と共通）
    infrastructure/       env.ts（接続先）・api/（orval 生成 REST クライアント）
    lib/utils.ts          cn()
  openapi/openapi.json    REST スキーマ（chrome-extension と同期 + lobby エンドポイント）
  Dockerfile              Next standalone 配信
```

- 旧 Django テンプレート（ランディング / 使い方 / ルーム遷移ロビー / 404）を **Next.js 15（App Router）+ Turbopack**
  に移行したユーザー向け公開ページ。技術スタック・UIコンポーネントは chrome-extension と共通化。
- 依存管理は **pnpm**、ビルドは Turbopack（`pnpm dev` / `pnpm build`）。
- ルーム遷移 `/anime-store/lobby/[roomId]` は拡張機能の `.chrome_extension_field` DOM 契約を維持しつつ、
  `room_id → リダイレクト URL` を新バックエンド API `GET /api/v1/anime-store/lobby/{room_id}` で解決する
  （backend サブモジュール側に別途実装が必要。`frontend/docs/backend-lobby-endpoint.md` 参照）。
- 接続先は `src/infrastructure/env.ts`（`NEXT_PUBLIC_*` で上書き、既定 `localhost`）。

## サブモジュール運用ルール（最重要）

1. **サービスのコード変更は必ず該当サブモジュール内で行う。**
   `cd backend` または `cd chrome-extension` してからブランチを切り、各上流リポジトリへ PR を出す。
2. このルートリポジトリでは **サブモジュールの参照（SHA）と開発設定のみ** をコミットする。
3. サブモジュールを更新したら、ルート側で参照を進めてコミットする:

   ```bash
   git submodule update --remote --merge        # 追跡ブランチ(main)の最新へ
   git add backend chrome-extension
   git commit -m "chore: bump submodules"
   ```

4. クローン直後にサブモジュールが空なら:

   ```bash
   git submodule update --init --recursive
   ```

5. **ルートリポジトリで `backend/` や `chrome-extension/` 内のファイルを直接書き換えて
   コミットしようとしない。** 変更はサブモジュール側のコミットとして扱うこと。

## Common commands

### スタック全体（このルートで実行）

docker-compose はルートにある（backend サブモジュールは django 単体）。

```bash
# 初回起動（migrate + collectstatic）
docker compose build --no-cache
docker compose up -d
docker compose exec django python manage.py makemigrations
docker compose exec django python manage.py makemigrations streamer
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic

# 2 回目以降
docker compose up -d
docker compose ps
docker compose logs -f django
# 監視系も起動する場合
docker compose --profile metrics up -d
```

### backend 単体（`cd backend`, uv）

```bash
# backend は django 単体。コンテナ無しで uv だけでも動かせる。
cd backend
uv sync
uv run pytest                 # conftest が InMemoryChannelLayer を使うため Redis 不要（DB は要 PostgreSQL）
uv run pip-licenses
```

### chrome-extension（`cd chrome-extension`）

```bash
# ビルド不要。chrome://extensions →「パッケージ化されていない拡張機能を読み込む」
# 接続先の変更は js/common/settings.js を編集する
```

## ローカル CI（act）

両サブモジュールとも GitHub Actions を持つ。Dev Container には `act` が入っているので、
各サブモジュールディレクトリで `act` を実行すればローカルでワークフローを再現できる。

```bash
cd backend && act push        # backend のワークフローを実行
```

## 動作確認 URL（ローカル backend 起動時）

| URL                     | 内容                                |
| ----------------------- | ----------------------------------- |
| `http://localhost`      | アプリ（Nginx 経由）                |
| `http://localhost:8000` | Django 直接（debug-toolbar 有効時） |
| `http://localhost:8080` | Adminer（PostgreSQL 管理）          |
| `http://localhost:9090` | Prometheus                          |

> 外部サービス（Google 等）は bot 検出でブロックされることがある。外部調査には
> `WebSearch` / `WebFetch` を優先し、ブラウザ検証は localhost に集中させること。
