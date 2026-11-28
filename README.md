<div align="center">

# d-party

dアニメストアの動画を、離れた友だちと同時視聴するためのブラウザ拡張機能とサーバ。

[![Backend / CI](https://github.com/d-party/d-party/actions/workflows/backend-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/backend-ci.yml)
[![Backend / Build](https://github.com/d-party/d-party/actions/workflows/backend-build.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/backend-build.yml)
[![Frontend / CI](https://github.com/d-party/d-party/actions/workflows/frontend-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/frontend-ci.yml)
[![Extension / CI](https://github.com/d-party/d-party/actions/workflows/extension-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/extension-ci.yml)
[![Repo / CI](https://github.com/d-party/d-party/actions/workflows/repo-ci.yml/badge.svg?branch=main)](https://github.com/d-party/d-party/actions/workflows/repo-ci.yml)
[![Coverage](https://raw.githubusercontent.com/d-party/d-party/python-coverage-comment-action-data/badge.svg)](https://htmlpreview.github.io/?https://github.com/d-party/d-party/blob/python-coverage-comment-action-data/htmlcov/index.html)

[![Website](https://img.shields.io/website?label=d-party.net&up_message=online&url=https%3A%2F%2Fd-party.net)](https://d-party.net)
[![room-par-day](https://img.shields.io/endpoint?url=https://d-party.net/api/shields/room-par-day)](https://d-party.net/stats)
[![user-par-day](https://img.shields.io/endpoint?url=https://d-party.net/api/shields/user-par-day)](https://d-party.net/stats)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[d-party.net](https://d-party.net) ・ [使い方](https://d-party.net/docs) ・ [Q&A](https://d-party.net/qa) ・ [統計](https://d-party.net/stats) ・ [Storybook](https://d-party.github.io/d-party/)

</div>

## d-party とは

dアニメストアには複数人で一緒に観る機能がありません。d-party のブラウザ拡張機能を入れると、
再生・一時停止・シークが同じルームの参加者全員に同期され、リアクションも送り合えます。

- 無料で、広告はありません。必要なのは各自のdアニメストア契約だけです。
- アカウント登録は不要です。ルームの URL を共有すれば始められます。
- 動画は各自のブラウザが再生します。サーバが中継するのは再生位置などの同期メッセージだけで、
  映像は扱いません。
-  Manifest V3 なので、Chrome 以外の Chromium 系ブラウザ（Edge など）でも読み込めます。

## リポジトリ構成

| パス | 中身 | スタック |
| --- | --- | --- |
| [`backend/`](backend/AGENTS.md) | Django バックエンド | Python · Django · Channels · DRF · PostgreSQL · Redis |
| [`extension/`](extension/AGENTS.md) | ブラウザ拡張機能 | Manifest V3 · TypeScript · React · rspack · Tailwind CSS |
| [`frontend/`](frontend/AGENTS.md) | ユーザー向け公開サイト | Next.js · React · TypeScript · Tailwind CSS |
| `packages/ui/` | extension と frontend が共有するUIコンポーネント | TypeScript · Radix · Tailwind CSS |
| [`infra/`](infra/README.md) | k3s (Raspberry Pi) デプロイ | Helm chart · Argo CD · rootless BuildKit |
| [`loadtest/`](loadtest/README.md) | WebSocket 負荷試験 | k6 |
| `nginx/` | リバースプロキシの設定 | docker compose |


## 開発

### 開発環境構築

- Docker / Docker Compose
- Chromium 系ブラウザ
- Python 3.15 / [uv](https://docs.astral.sh/uv/)
- Node.js 26 / [pnpm](https://pnpm.io/)


> [!NOTE]
> [Dev Container](https://containers.dev/) を用意しています。
>
> 手順 1 の `pnpm install`・`uv sync`・`pre-commit install` も初回起動時に実行されるので、
> 手順 2 から始めてください。

### 1. cloneして依存をインストールする

```bash
git clone git@github.com:d-party/d-party.git
cd d-party

pnpm install
(cd backend && uv sync)
pre-commit install
```

### 2. スタックを起動する

```bash
docker compose up -d
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic --noinput
```

`docker-compose.override.yml` が自動で読み込まれ開発用の環境が立ち上がります。

| URL | 内容 |
| --- | --- |
| <http://localhost> | アプリ（Nginx 経由） |
| <http://localhost:8000> | Django（Nginx を通さない） |
| <http://localhost:8000/admin/> | 管理画面（Unfold） |

2 回目以降は `docker compose up -d` だけで起動します。

Dev Container では、PostgreSQL を VS Code の SQLTools 拡張の `d-party (compose postgres)`
接続で開けます。Redis は Redis for VS Code 拡張に `127.0.0.1:6379` を登録して見ます。

### 3. 拡張機能を読み込む

```bash
pnpm --filter d-party-chrome-extension run build
```

1. ブラウザで `chrome://extensions`（Edge は `edge://extensions`）を開く
2. 「デベロッパーモード」を有効にする
3. 「パッケージ化されていない拡張機能を読み込む」で `extension/dist/` を選ぶ

接続先はビルド時の環境変数 `D_PARTY_ENV` で決まります。未指定なら `localhost`（http / ws）、
`production` なら `d-party.net`（https / wss）です。上のコマンドは未指定なので、ローカルの
バックエンドに繋がります。定義は `extension/src/infrastructure/env.ts` にあります。

dアニメストアのページから `localhost` のバックエンドへ繋ぐには、Chrome の
`chrome://flags/#block-insecure-private-network-requests` を Disabled にしてください。
既定では Private Network Access の制限で接続がブロックされます。

## 開発

### よく使うコマンド

ルートの `package.json` のスクリプトは、Turborepo で全パッケージに対して実行されます。
`lint`・`typecheck`・`build` の前には `api:generate` が走り、入力が変わっていないタスクは
キャッシュが使われます。

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

backend は pnpm workspace に含まれないので、`backend/` で直接実行します。

```bash
cd backend
uv run pytest         # conftest が InMemoryChannelLayer を使うので Redis 不要
uv run mypy .
uv run ruff check .
```

### CI を手元で再現する

```bash
actionlint                                   # Repo / CI
shellcheck $(git ls-files '*.sh')            # Repo / CI
yamllint .                                   # Repo / CI
helm lint infra/helm/d-party --set secret.existingSecret=d-party-secret  # Infra / CI
pre-commit run --all-files
```

ruff は `uv run ruff` で実行してください。`backend/uv.lock` で固定した版が使われます。
グローバルに入れた ruff や `uvx ruff` は版が違うことがあり、整形結果が CI と食い違います。

ワークフロー自体を実行したいときは、リポジトリのルートで `act` を使います
（Dev Container に入っています）。

### Storybook

UI コンポーネントの Storybook を GitHub Pages で公開しています。`main` にマージすると更新されます。

- <https://d-party.github.io/d-party/extension/> — 拡張機能（暗いテーマ）
- <https://d-party.github.io/d-party/frontend/> — 公開サイト（暗いテーマ）
- ローカル: `pnpm --filter d-party-frontend run storybook`（<http://localhost:6006>）

`packages/ui` のコンポーネントは両方に載っており、それぞれのテーマトークンでの見た目を確認できます。

### CI

ワークフローはすべてルートの `.github/workflows/` にあり、`paths` フィルタによって、
変更したディレクトリに対応するものだけが走ります。`<Scope> / CI` は lint・型検査・テストを、
`<Scope> / Build` は成果物をビルドして実際に動くことを確認します。

| ワークフロー | 対象 |
| --- | --- |
| `Backend / CI` | ruff · pytest · mypy · license-check |
| `Backend / Build` | イメージをビルドして migrate し、起動後に API が応答することを確認 |
| `Frontend / CI` · `Extension / CI` | 生成コードの差分検出 · typecheck · lint · license-check |
| `Frontend / Build` | next build · storybook · イメージを起動してページの応答を確認 |
| `Extension / Build` | 本番ビルド · manifest が参照するファイルの存在確認 · zip · storybook |
| `Infra / CI` | helm lint · helm template |
| `Nginx / CI` | nginx テンプレートの構文チェック |
| `Repo / CI` | actionlint · shellcheck · yamllint · CodeQL |
| `Storybook / Deploy` | 2 つの Storybook を GitHub Pages に公開 |
| `Release` | 全パッケージのリリース（手動実行） |

依存のキャッシュはロックファイルのハッシュをキーにしています。pnpm ストア、Turborepo、
Next の `.next/cache` は `pnpm-lock.yaml`、uv は `backend/uv.lock` です。

### 環境変数

compose が読む環境変数は次の env ファイルに分けてあります。どちらも開発用の値で、本番（k3s）の
値は Helm の values と Secret が与えます。

| ファイル | 用途 | 主なキー |
| --- | --- | --- |
| `.env.global` | 全サービス共通 | `POSTGRES_*` · `*_UPSTREAM` · `TZ` · `D_ANIME_STORE_DOMAIN` |
| `.env.dev` | 接続先など | `DEBUG=1` · `MY_DOMAIN=localhost` · `NEXT_PUBLIC_*`（http / ws） |

## 本番デプロイ

Raspberry Pi の k3s クラスタに Helm chart をデプロイし、Argo CD で同期します。外部からの
アクセスは Cloudflare Tunnel 経由で、TLS も Cloudflare 側で終端します。設定は
[`infra/`](infra/README.md) にあります。

リリースは GitHub Actions の `Release` ワークフローを手動で実行します。このワークフローは
次のことを行います。

1. 全パッケージの version を揃えてタグを打つ
2. backend と frontend のイメージ（amd64 / arm64）を GHCR に push する
3. 拡張機能を Chrome Web Store にアップロードする

GHCR に `vX.Y.Z` タグのイメージが上がると argocd-image-updater が検知し、Argo CD が
ローリング更新します。

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

パラメータと計測している指標は [`loadtest/README.md`](loadtest/README.md) にあります。
