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

## デプロイ（k3s / Helm / GitOps）

本番想定は **Raspberry Pi (arm64) で組んだ k3s クラスタ**への Helm デプロイ。CD は
**Argo CD（GitOps）**。設定一式は `deploy/` にある。詳細手順は
[`deploy/README.md`](deploy/README.md)（および [`deploy/platform/README.md`](deploy/platform/README.md)）を参照。

```
deploy/
  helm/d-party/        d-party 単体の Helm chart（このリポジトリの本体）
    templates/         nginx · django · frontend · postgres · redis · migrate(hook)
                       · networkpolicy · priorityclass · ingress(任意)
    values.yaml
  platform/            クラスタ共有の基盤（d-party 専用ではない singleton）
    registry.yaml      クラスタ内ローカルレジストリ（registry:2）+ NodePort
    k3s-registries.yaml  各ノードの /etc/rancher/k3s/registries.yaml
  build/               d-party 固有: rootless BuildKit で arm64 ネイティブビルド → 共有レジストリへ push
  argocd/              Argo CD Application の雛形（実体は運用リポジトリへ）
```

設計の要点（**docker-compose とは前提が異なる**ので注意）:

- **ドメイン解決と TLS は Cloudflare Tunnel（cloudflared）がエッジで終端**する。chart は
  クラスタ内 HTTP のみを扱い、nginx は `ClusterIP`（cloudflared が `nginx` Service を指す）。
  cloudflared 本体・ドメイン割り当て・Argo CD 本体の導入は **別の運用リポジトリ**の管轄。
- **マルチテナント前提**: 同じ端末で d-party 以外のサービスも同居できる。リソースは
  release 名で prefix され namespace 非固定。RPi 想定で `replicaCount` は既定 1。
- **d-party は自前の postgres / redis を chart に同梱し、他サービスとは共有しない**。
  別サービスが DB/Redis を要るなら、そのサービス側で別途立てる。
- **共有クラスタ基盤（`deploy/platform/`）は d-party の所有物ではない**。chart はそこを
  「既にある共有レジストリ」として参照するだけ。理想は別 platform リポジトリへ切り出し。
- **隔離・優先度**: postgres/redis は `NetworkPolicy` で同 release 内からのみ到達可能にし、
  `PriorityClass`（stateful > app）でメモリ逼迫時にも DB を優先保護する。
- 機微値（`SECRET_KEY` / `POSTGRES_PASSWORD`）は values に直書きせず `secret.existingSecret`
  （SealedSecrets/SOPS 等）で渡すのが既定方針。`config.MY_DOMAIN` は単一ドメイン前提。
- backend イメージは無改変で使う（gunicorn の workers / graceful などは env で上書き）。
  WebSocket を切らさないため django は `replicas: 1` 固定＋グレースフルなローリング更新。

```bash
# chart の静的検証（クラスタ不要）
helm lint deploy/helm/d-party
helm template d-party deploy/helm/d-party | less

# 手元で実クラスタ検証（k3d）。詳細は deploy/README.md
k3d cluster create d-party --agents 2
helm upgrade --install d-party deploy/helm/d-party -n d-party --create-namespace \
  --set config.MY_DOMAIN=d-party.example --set secret.existingSecret=d-party-secret
k3d cluster delete d-party        # 後始末
```

## 負荷試験（loadtest/）

backend の **WebSocket（Channels）同時視聴同期** を主対象とした負荷試験。**k6** で
nginx → django(daphne) → Redis channel layer / PostgreSQL という組み上がったスタックを
本番に近い経路でブラックボックス的に叩く。詳細は [`loadtest/README.md`](loadtest/README.md)。

```
loadtest/
  lib/protocol.js        djcrf エンベロープ（action/request_id）の組み立て・遅延計測の埋め込み
  lib/participant.js     1 WS 接続を Promise 化（connect / waitFor(action)）
  scenarios/ws_party.js  1 VU=1 ルーム。create→join→video/reaction→leave のシナリオ
  scenarios/ws_timer.js  タイマー（観覧専用）。host のみ配信し spectate 参加者へ配信増幅
  results/               k6 サマリ出力（gitignore）
docker-compose.loadtest.yml   k6 サービス（compose の loadtest profile。通常起動に非干渉）
```

配置方針（**サブモジュール規約との関係**）:

- 負荷試験は**オーケストレーション層の関心事**（docker-compose / nginx / env を持つルートが対象）
  なので、`backend/` ではなく**ルートリポジトリ**に置く。`deploy/` と同じカテゴリ。
- backend のコードではなく「走っているスタックへの外形テスト」なので、サブモジュール規約には反しない。
- 負荷の本質は **ブロードキャスト増幅**: 1 ルーム N 人で 1 人の操作が `group_send` で N-1 接続へ
  配信される（O(N) ファンアウト）。単発 RPS ではなく多接続常時接続下の捌きを測る。
- `consumers.py` の `_pending_room_deletes` は **プロセス内 dict + asyncio.Task で「単一 daphne
  ワーカー前提」**。マルチワーカー / 水平スケール下でのルーム整合はスケール試験で要確認。

```bash
# スタックを起動してから loadtest profile を run（スモーク: 1 ルーム×3 人、30s）
docker compose up -d
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# パラメータは LOADTEST_* env で上書き（例: 20 ルーム×5 人 = 100 接続、2 分）
LOADTEST_VUS=20 LOADTEST_ROOM_SIZE=5 LOADTEST_DURATION=2m \
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# スクリプトの静的検証（スタック不要・実行しない）
docker run --rm -v "$PWD/loadtest:/loadtest" -w /loadtest \
  grafana/k6:0.55.0 inspect /loadtest/scenarios/ws_party.js
```

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

## 開発フロー（GitHub Flow）

このプロジェクトは **GitHub Flow** を採用する（旧 Git Flow から移行済み。`develop` は廃止）。
ルート・各サブモジュールとも同じ運用ルール:

1. `main` は常にデプロイ可能な状態を保つ。
2. すべての変更は `main` から短命なブランチを切る（命名は `feature/*` · `fix/*` ·
   `chore/*` · `docs/*` の kebab-case）。
3. ブランチへ commit / push し、`main` に対して **Pull Request** を出してマージする。
   `main` へ直接コミットしない。
4. マージ済みブランチは削除する。
5. **リリースは `main` から tag を切って行う**（長命なリリースブランチは作らない）。
   - backend / chrome-extension とも `release` ワークフロー（`workflow_dispatch`）で
     バージョン tag と GitHub Release を発行する。
6. CI のトリガ・Dependabot の `target-branch` はすべて `main`（`develop` は参照しない）。

詳細な貢献手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照。

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
# migration ファイルは backend リポジトリにコミット済みなので migrate のみでよい
# （モデル変更時だけ backend サブモジュール側で makemigrations して生成物をコミットする）
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
