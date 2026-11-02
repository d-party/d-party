# AGENTS.md — d-party

dアニメストアでの「同時視聴」サービスの monorepo。各ディレクトリの詳細はそこにある
`AGENTS.md` を読むこと。

| パス | 中身 | スタック |
| --- | --- | --- |
| `backend/` | Django バックエンド | Python 3.15 · Django 6 · Channels · DRF · PostgreSQL 16 · Redis 7 |
| `extension/` | ブラウザ拡張機能 | Manifest V3 · TypeScript · React 19 · rspack · Tailwind CSS v4 |
| `frontend/` | 公開サイト | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| `packages/ui/` | 共有 shadcn/ui プリミティブ | TypeScript · Radix · Tailwind CSS v4 |
| `infra/` | k3s (Raspberry Pi) デプロイ | Helm · Argo CD · rootless BuildKit |
| `loadtest/` | WebSocket 負荷試験 | k6 |
| `.github/` | CI / リリース | GitHub Actions |

```
拡張機能 (dアニメストアのページに content script を注入)
        │  WebSocket (wss://d-party.net)
        ▼
Nginx ──▶ Django (gunicorn + uvicorn-worker / dev は runserver)
        ├─ REST API (DRF)      : /api/*
        ├─ WebSocket (Channels): /anime-store/party/
        └─ 管理画面 (Unfold)   : /admin/*
      ──▶ Next.js              : それ以外の公開ページ
Django ──▶ PostgreSQL（永続化） / Redis（Channels レイヤ）
```

負荷の本質は**ブロードキャスト増幅**。1 ルーム N 人で 1 人の操作が N-1 接続へ配信される。
計測基盤（Prometheus など）は持っていない。

## 公開インターフェース

次は拡張機能・フロント・backend の間の契約。片側だけ変えないこと。

- WebSocket プロトコル: `backend/streamer/format.py` ⇔ `extension/src/domain/protocol.ts`
- REST API: `backend/api/` ⇔ `{extension,frontend}/openapi/openapi.json`（orval で生成）
- ロビーの DOM 契約: `frontend` の `.chrome_extension_field` ⇔ `extension` の `content-version`

## docker compose（ルート）

```
docker-compose.yml            nginx · django · frontend · postgres · redis
docker-compose.override.yml   dev（既定。frontend は pnpm dev）
docker-compose.prod.yml       prod（nginx が TLS 終端・certbot）
docker-compose.loadtest.yml   k6（loadtest profile）
.env.global                   全環境共通の env
.env.dev / .env.prod          環境固有の env
nginx/ postgres/ redis/       各サービスの設定
```

- frontend のビルドコンテキストはルート（`dockerfile: frontend/Dockerfile`）。
  ロックファイルがルートにあり、`frontend/` 単体では `--frozen-lockfile` を満たせない。
- `DEBUG` / `MY_DOMAIN` などの環境固有値を `.env.global` に置かない。backend は
  `.env.global` を `override=True` で読むので、本番の値が上書きされる。

```bash
docker compose up -d
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic
docker compose logs -f django
```

| URL | 内容 |
| --- | --- |
| `http://localhost` | アプリ（Nginx 経由） |
| `http://localhost:8000/admin/` | 管理画面 |

DB は VS Code の SQLTools（接続は定義済み）、Redis は Redis for VS Code
（初回だけ `127.0.0.1:6379` を登録）で見る。

## pnpm workspace

パッケージは `extension/`（`d-party-chrome-extension`）・`frontend/`（`d-party-frontend`）・
`packages/ui/`（`@d-party/ui`）の 3 つ。`--filter` はディレクトリ名ではなくパッケージ名で指す。

- **依存はルートで入れる。** パッケージ内で `pnpm install` しない。追加は
  `pnpm --filter <pkg> add <dep>`。ロックファイルはルートの `pnpm-lock.yaml` 1 本。
- pnpm は `packageManager` で 12 系にピン留め。ビルドスクリプトの許可は
  `pnpm-workspace.yaml` の `allowBuilds`（廃止されたキーを書くと pnpm がエラーにする）。
- `minimumReleaseAge`（公開から 1 日待つ）は既定のまま使う。
- corepack は使わない。Dev Container の node feature が pnpm を入れ、pnpm 自身が
  ピンの版に差し替える。
- `turbo.json` の `agentGuidance: false` を外さない。外すと turbo がこのファイルへ
  英語のブロックを書き足し続ける。

```bash
pnpm install
pnpm run api:generate && pnpm run typecheck && pnpm run lint && pnpm run build
pnpm --filter d-party-frontend run build
turbo run lint typecheck build --filter='...[origin/main]'
```

## Python

- 仮想環境は `backend/.venv` の 1 つだけ（`postCreateCommand` の `uv sync` が作る）。
  他の場所に `.venv` を作らない。backend 以外で Python ツールが要るなら `uvx` で使い捨てにする。
- ruff はグローバルに入れず `uv run ruff` を使う（`uv.lock` のピンと CI を揃えるため）。

## 開発フロー

GitHub Flow。`main` から `feature/*` · `fix/*` · `chore/*` · `docs/*` のブランチを切り、
PR でマージする。backend・frontend・拡張機能にまたがる変更も 1 本の PR にする。
詳細は [CONTRIBUTING.md](CONTRIBUTING.md)。

## monorepo の約束

1. CI のワークフローはルートの `.github/workflows/` にしか置けない。
2. README と LICENSE はルートに 1 本だけ。設計とコードの約束は各ディレクトリの `AGENTS.md` に書く。
3. バージョンは全パッケージで揃える。`Release` ワークフローが一括で書き換えるので手で上げない。
4. ルートから走るツールの設定はルートに置く（`.yamllint` · `.dockleignore` · `.pre-commit-config.yaml`）。

## ローカルで CI を再現する

```bash
actionlint && shellcheck $(git ls-files '*.sh') && yamllint .
helm lint infra/helm/d-party
pre-commit run --all-files
cd backend && uv run ruff check . && uv run mypy . && uv run pytest
pnpm run typecheck && pnpm run lint && pnpm run build
act pull_request -W .github/workflows/frontend-ci.yml
```

外部サイトは bot 検出でブロックされることがある。調べものは WebSearch / WebFetch を使い、
ブラウザでの確認は localhost に絞る。
