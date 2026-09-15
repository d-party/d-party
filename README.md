<div align="center">

# d-party

**dアニメストアの動画を、離れた友だちと「同時視聴」する。**

[![Backend/CI](https://github.com/d-party/d-party/actions/workflows/backend-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/backend-ci.yml)
[![Backend/Build](https://github.com/d-party/d-party/actions/workflows/backend-build.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/backend-build.yml)
[![Frontend/CI](https://github.com/d-party/d-party/actions/workflows/frontend-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/frontend-ci.yml)
[![Extension/CI](https://github.com/d-party/d-party/actions/workflows/extension-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/extension-ci.yml)
[![Repo/CI](https://github.com/d-party/d-party/actions/workflows/repo-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/repo-ci.yml)
[![Coverage](https://raw.githubusercontent.com/d-party/d-party/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/d-party/d-party/blob/python-coverage-comment-action-data/htmlcov/index.html)

[![Website](https://img.shields.io/website?label=d-party.net&up_message=online&url=https%3A%2F%2Fd-party.net)](https://d-party.net)
[![Security Headers](https://img.shields.io/security-headers?url=https%3A%2F%2Fd-party.net)](https://securityheaders.com/?q=https%3A%2F%2Fd-party.net&followRedirects=on)
[![room-par-day](https://img.shields.io/endpoint?url=https://d-party.net/api/shields/room-par-day)](https://d-party.net/stats)
[![user-par-day](https://img.shields.io/endpoint?url=https://d-party.net/api/shields/user-par-day)](https://d-party.net/stats)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[![Python](https://img.shields.io/badge/Python-3.14-F9DC3E.svg?logo=python&logoColor=white&style=flat)](https://www.python.org/)
[![Django](https://img.shields.io/badge/Django-6-092E20.svg?logo=django&logoColor=white&style=flat)](https://www.djangoproject.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000.svg?logo=nextdotjs&style=flat)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black&style=flat)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6.svg?logo=typescript&logoColor=white&style=flat)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?logo=postgresql&logoColor=white&style=flat)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-FF4438.svg?logo=redis&logoColor=white&style=flat)](https://redis.io/)
[![Nginx](https://img.shields.io/badge/Nginx-009639.svg?logo=nginx&logoColor=white&style=flat)](https://nginx.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED.svg?logo=docker&logoColor=white&style=flat)](https://www.docker.com/)
[![uv](https://img.shields.io/badge/uv-managed-DE5FE9.svg?logo=uv&logoColor=white&style=flat)](https://docs.astral.sh/uv/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220.svg?logo=pnpm&logoColor=white&style=flat)](https://pnpm.io/)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444.svg?logo=turborepo&logoColor=white&style=flat)](https://turborepo.com/)

[d-party.net](https://d-party.net) ・ [使い方](https://d-party.net/usage) ・ [Q&A](https://d-party.net/qa) ・ [統計](https://d-party.net/stats) ・ [Storybook](https://d-party.github.io/d-party/)

</div>

---

## d-party とは

dアニメストアには「一緒に観る」機能がありません。d-party は**ブラウザ拡張機能**を入れるだけで、
再生・一時停止・シークを参加者全員へ同期し、リアクションを飛ばし合えるようにします。

- **無料・広告なし。** 必要なのは各自のdアニメストア契約だけです。
- **アカウント登録なし。** ルームの URL を共有するだけで始められます。
- **動画は各自のブラウザが再生します。** サーバが中継するのは「誰がどこを観ているか」という
  同期メッセージだけで、映像そのものは一切扱いません。

### 使う側の流れ

1. 拡張機能をインストールする
2. dアニメストアで作品を開き、プレイヤー横の **パーティー作成** を押す
3. 出てきた `https://d-party.net/anime-store/lobby/<room-id>` を友だちに送る
4. 相手がリンクを開くと、同じ再生位置から一緒に視聴が始まる

拡張機能を入れていない人向けに、再生位置だけを追える**タイマー画面**（`?timer=true`）も
用意しています。

## 仕組み

```
ブラウザ拡張機能（dアニメストアのページへ content script を注入）
        │  WebSocket (wss://d-party.net)
        ▼
  Nginx :80/443
        ├──▶ Next.js         公開ページ（/ · /usage · /qa · /stats · ロビー）
        └──▶ Django (ASGI)
               ├─ REST API (DRF)      : /api/*
               ├─ WebSocket (Channels): 同時視聴の同期
               └─ 管理画面 (Unfold)   : /admin/*
                        │
                        ├──▶ PostgreSQL 16   ルーム・参加者・統計
                        └──▶ Redis 7         Channels レイヤ / キャッシュ
```

負荷の本質は **ブロードキャスト増幅**です。1 ルーム N 人で 1 人が操作すると、`group_send` で
N-1 接続へ配信されます（O(N) ファンアウト）。この特性を測る k6 の負荷試験を
[`loadtest/`](loadtest/README.md) に用意しています。

## リポジトリ構成

| パス | 中身 | スタック |
| --- | --- | --- |
| [`backend/`](backend/AGENTS.md) | Django バックエンド | Python 3.14 · Django 6 · Channels · DRF · PostgreSQL 16 · Redis 7 |
| [`extension/`](extension/AGENTS.md) | ブラウザ拡張機能 | Manifest V3 · TypeScript · React 19 · rspack · Tailwind CSS v4 |
| [`frontend/`](frontend/AGENTS.md) | ユーザー向け公開サイト | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 |
| `packages/ui/` | 両者が共有する shadcn/ui プリミティブ | TypeScript · Radix · Tailwind CSS v4 |
| [`infra/`](infra/README.md) | k3s (Raspberry Pi) デプロイ | Helm chart · Argo CD · rootless BuildKit |
| [`loadtest/`](loadtest/README.md) | WebSocket 負荷試験 | k6 |
| `nginx/` `postgres/` `redis/` | オーケストレーション | docker compose |

`extension/` · `frontend/` · `packages/ui/` は **pnpm workspace** の 3 パッケージで、
ロックファイルはルートの `pnpm-lock.yaml` 1 本です。ビルド・lint・型検査の
オーケストレーションは [Turborepo](https://turborepo.com/)（`turbo.json`）が行います。

> `extension/` はブラウザ名を含まない名前にしています。Manifest V3 なので Edge など
> Chromium 系ブラウザでもそのまま読み込めます。

## はじめかた

### 必要なもの

- **Docker** + Docker Compose v2
- **Chromium 系ブラウザ**（拡張機能の動作確認用）
- コンテナ無しで動かす場合: **Python 3.14** + [uv](https://docs.astral.sh/uv/) /
  **Node.js 26** + [pnpm](https://pnpm.io/) 10

> **Dev Container を推奨します。** VS Code でこのフォルダを開き
> **Dev Containers: Reopen in Container** を選ぶと、上記に加えて CI と同じ lint
> （actionlint / shellcheck / yamllint / pre-commit）· helm · k3d · k6 · GitHub CLI が揃い、
> `uv sync` と `pnpm install` と `pre-commit install` まで自動で走ります。

### 1. クローンして依存を入れる

```bash
git clone git@github.com:d-party/d-party.git
cd d-party

pnpm install              # extension + frontend + packages/ui（ルートで 1 回）
(cd backend && uv sync)   # backend
pre-commit install        # backend 向けのフック。ルートで実行する
```

> Dev Container を使う場合、この手順は初回起動時に自動で走ります。

### 2. スタックを起動する

```bash
docker compose up -d
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic --noinput
```

`docker compose up -d` は **開発モード**です（`docker-compose.override.yml` が自動で
読み込まれます）。frontend は `pnpm dev`（Turbopack HMR）で立ち上がるため、初回は依存の
インストールと初回コンパイルで数分かかります（ヘルスチェックの猶予は 3 分）。

| URL | 内容 |
| --- | --- |
| <http://localhost> | アプリ（Nginx 経由） |
| <http://localhost:8000> | Django 直接 |
| <http://localhost:8000/admin/> | 管理画面（Unfold） |

2 回目以降は `docker compose up -d` だけです。

> PostgreSQL は **VS Code の SQLTools 拡張**（Dev Container 同梱）から
> `d-party (compose postgres)` 接続で開けます。Redis は **Redis for VS Code 拡張**で、
> 初回だけ `127.0.0.1:6379` を登録してください。

### 3. 拡張機能を読み込む

```bash
pnpm --filter d-party-chrome-extension run build
```

1. ブラウザで `chrome://extensions`（Edge は `edge://extensions`）を開く
2. **デベロッパーモード** を有効化する
3. **パッケージ化されていない拡張機能を読み込む** で `extension/dist/` を選ぶ

接続先は `extension/src/infrastructure/env.ts` に集約しており、**ビルド時の環境変数
`D_PARTY_ENV`** で切り替わります（未指定 = `localhost` / http / ws、`production` =
`d-party.net` / https / wss）。上の `pnpm build` は未指定なのでローカルスタックを向きます。

> dアニメストアの実ページから `localhost` のバックエンドへ繋ぐときは、Chrome の
> Private Network Access ブロックを無効化する必要があります
> （`chrome://flags/#block-insecure-private-network-requests` を Disabled）。

## 開発

### よく使うコマンド

ルートの `package.json` から Turborepo 経由でまとめて回せます。`turbo` が依存関係
（`api:generate` → `lint` / `typecheck` / `build`）と出力キャッシュを管理するので、
変わっていないタスクは再実行されません。

```bash
pnpm run api:generate     # OpenAPI から REST クライアントを生成
pnpm run typecheck        # tsc --noEmit
pnpm run lint             # eslint
pnpm run build            # extension の rspack + frontend の next build
pnpm run build-storybook
pnpm run license:check

# パッケージを絞る
pnpm --filter d-party-frontend run dev
turbo run lint --filter=d-party-chrome-extension
# 変更の影響範囲だけ
turbo run lint typecheck build --filter='...[origin/main]'
```

backend は Python なので workspace の外です。

```bash
cd backend
uv run pytest         # conftest が InMemoryChannelLayer を使うので Redis 不要
uv run mypy .
uv run ruff check .
```

### CI を手元で再現する

```bash
actionlint                                   # Repo/CI
shellcheck $(git ls-files '*.sh')            # Repo/CI
yamllint .                                   # Repo/CI
helm lint infra/helm/d-party                 # Infra/CI
pre-commit run --all-files
```

> **ruff はグローバルに入れないでください。** `backend/uv.lock` にピン留めしたものを
> `uv run ruff` で使います。`uvx ruff` だと常に最新が取れてしまい、整形結果が CI とズレます。

ワークフローそのものを回したい場合は `act`（Dev Container 同梱）をリポジトリのルートで。

### Storybook

UI コンポーネントのカタログを GitHub Pages へ公開しています（`main` へのマージ時に自動デプロイ）。

- <https://d-party.github.io/d-party/extension/> — 拡張機能（明るいテーマ）
- <https://d-party.github.io/d-party/frontend/> — 公開サイト（暗いテーマ）
- ローカル: `pnpm --filter d-party-frontend run storybook`（<http://localhost:6006>）

共有の `packages/ui` は両方に現れます。テーマトークンが異なるので、同じプリミティブを
2 つの配色で確認できます。

### CI

ワークフローはルートの `.github/workflows/` に集約し、`paths` フィルタで触った
ディレクトリに対応するものだけを回します。`<Scope>/CI` は lint と型検査とテスト、
`<Scope>/Build` は「出荷するものが実際に組み上がって動くか」を見ます。

| ワークフロー | 対象 |
| --- | --- |
| `Backend/CI` | ruff · pytest · mypy · license-check |
| `Backend/Build` | イメージを組んで migrate し、起動して API が応答するまで確認 |
| `Frontend/CI` · `Extension/CI` | 生成物の drift · typecheck · lint · license-check |
| `Frontend/Build` | next build · storybook · イメージを起動してページ疎通 |
| `Extension/Build` | 本番ビルド · manifest の参照先の実在確認 · zip · storybook |
| `Infra/CI` | helm lint · helm template |
| `Nginx/CI` | nginx テンプレートの構文チェック |
| `Repo/CI` | actionlint · shellcheck · yamllint · CodeQL · reviewdog |
| `Storybook/Deploy` | 両 Storybook を GitHub Pages のサブパスへ公開 |
| `Release` | 統一リリース（手動実行） |

依存のキャッシュはロックファイルのハッシュをキーにしています（pnpm ストア →
`pnpm-lock.yaml`、uv → `backend/uv.lock`、Turborepo と Next の `.next/cache` →
`hashFiles('pnpm-lock.yaml')`）。

### 環境設定（dev / prod の出し分け）

環境固有の設定は 3 つの env ファイルに分け、compose のオーバーレイで切り替えます。

| ファイル | 用途 | 主なキー |
| --- | --- | --- |
| `.env.global` | dev / prod 共有 | `POSTGRES_*` · `*_UPSTREAM` · `TZ` · `D_ANIME_STORE_DOMAIN` |
| `.env.dev` | 開発のみ | `DEBUG=1` · `MY_DOMAIN=localhost` · `NEXT_PUBLIC_*`（http / ws） |
| `.env.prod` | 本番のみ | `DEBUG=0` · `MY_DOMAIN=d-party.net` · `CERTBOT_EMAIL` · `NEXT_PUBLIC_*`（https / wss） |

> 環境固有値（`DEBUG` / `MY_DOMAIN` など）は **`.env.global` に置かないでください。**
> backend の `manage.py` が `/env_files/.env.global` を `override=True` で読むため、
> ここに残すと本番起動時に dev の値で上書きされます。

## 本番デプロイ

### A. docker compose + Let's Encrypt（単一ホスト）

nginx が TLS を終端し、certbot（webroot / http-01）が証明書を自動取得・自動更新します。

```bash
# .env.prod の MY_DOMAIN と CERTBOT_EMAIL を実値にしてから
./init-letsencrypt.sh --staging      # まずテスト証明書で疎通確認
./init-letsencrypt.sh --production

docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    --profile letsencrypt up -d
```

certbot は 12 時間ごとに `renew` を試み、nginx は 6 時間ごとに reload して新しい証明書を
取り込みます。証明書と秘密鍵は `./certbot/`（gitignore 済み）に置かれます。

### B. k3s (Raspberry Pi) + Helm + Argo CD

Raspberry Pi で組んだ k3s クラスタへ Helm chart をデプロイし、CD は Argo CD（GitOps）。
ドメイン解決と TLS は Cloudflare Tunnel がエッジで終端します。設定一式は
[`infra/`](infra/README.md) にあります。

リリースは GitHub Actions の `Release` ワークフロー（`workflow_dispatch`）1 本で完結します。
全パッケージの version を揃えてタグを打ち、backend / frontend の arm64 イメージを GHCR へ
push し、拡張機能を Chrome Web Store へ upload します。GHCR に上がった `vX.Y.Z` タグを
argocd-image-updater が拾い、Argo CD がローリング更新します。

## 負荷試験

```bash
docker compose up -d

# スモーク（1 ルーム×3 人、30 秒）
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# スケール例（20 ルーム×5 人 = 100 接続、2 分）
LOADTEST_VUS=20 LOADTEST_ROOM_SIZE=5 LOADTEST_DURATION=2m \
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6
```

パラメータと計測メトリクスの詳細は [`loadtest/README.md`](loadtest/README.md) を参照してください。

## コントリビュート

**GitHub Flow** です。`main` から短命なブランチを切り、`main` に対して PR を出します。
monorepo なので、backend と frontend と拡張機能にまたがる変更も 1 本の PR で出せます。
詳細は [CONTRIBUTING.md](CONTRIBUTING.md)、設計とコードの約束ごとは [AGENTS.md](AGENTS.md)
を参照してください。

## サードパーティ素材

リアクションのアニメーションは **Google Noto Emoji**
（[noto-emoji-animation](https://googlefonts.github.io/noto-emoji-animation/)）の Lottie を
使用しています（Apache License 2.0）。静的アイコンは
[react-icons](https://react-icons.github.io/react-icons/) と [lucide](https://lucide.dev/) です。

> エクストラリアクション 200 種の Lottie を `content-party` バンドルへ静的 import している
> ため、当該バンドルは十数 MB あります（オフラインで動く代わりにサイズが大きい）。

## ライセンス

MIT License（[LICENSE](LICENSE)）。Copyright (c) 2026 d-party.
