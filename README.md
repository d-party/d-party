# d-party

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**dアニメストアで「同時視聴」を実現する d-party プロジェクトの開発用 monorepo です。**

このリポジトリは複数の Git サブモジュールを束ねた **疑似 monorepo** です。
各サービスは独立したリポジトリとして管理されつつ、このリポジトリから一括で
クローン・開発できるようにまとめてあります。

## 構成

| パス                | サービス            | スタック                                                        | リポジトリ                                                                        |
| ------------------- | ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `backend/`          | Django バックエンド | Python 3.13 · Django 5 · Channels · DRF · PostgreSQL · Redis · Nginx | [backend](https://github.com/d-party/backend)                     |
| `chrome-extension/` | Chrome 拡張機能     | Manifest V3 · Vanilla JS · jQuery 3.6                           | [chrome-extension](https://github.com/d-party/chrome-extension) |
| `frontend/`         | ユーザー向けフロントエンド | Next.js 15 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · pnpm | [frontend](https://github.com/d-party/frontend)                   |

各サブモジュールは `main` ブランチを追跡しています（`.gitmodules` 参照）。

## 必要要件

- **Git** 2.13 以降（サブモジュール操作のため）
- **Docker** + Docker Compose v2（バックエンドのフルスタック起動に必須）
- **Google Chrome**（拡張機能の動作確認用）
- 個別サービスをローカル開発する場合:
  - **Python 3.13** + [uv](https://docs.astral.sh/uv/)（バックエンド）
  - **Node.js** + [pnpm](https://pnpm.io/)（フロントエンド）

> 推奨: 後述の [Dev Container](#dev-container) を使うと上記ツールが一括で揃います。

## クイックスタート

### 1. サブモジュールごとクローン

```bash
git clone --recurse-submodules git@github.com:d-party/d-party.git
cd d-party
```

すでにクローン済みでサブモジュールが空の場合:

```bash
git submodule update --init --recursive
```

### 2. バックエンドを起動

docker-compose はこのリポジトリのルートにあります（backend サブモジュールは django 単体）。
初回は Django の migrate と collectstatic が必要です。

```bash
# リポジトリのルートで
docker compose build --no-cache
docker compose up -d
docker compose exec django python manage.py makemigrations
docker compose exec django python manage.py makemigrations streamer
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic
docker compose down
docker compose up -d
```

2 回目以降は `docker compose up -d` だけで起動できます。これは **開発モード**で、
frontend は `pnpm dev`（HMR）として立ち上がります。dev / prod の切り替えと環境変数は
[環境設定（dev / prod の出し分け）](#環境設定dev--prod-の出し分け)を参照してください。
backend 個別の詳細は [`backend/README.md`](backend/README.md) を参照してください。

### 3. Chrome 拡張機能を読み込む

1. Chrome で `chrome://extensions` を開く
2. **デベロッパーモード** を有効化
3. **パッケージ化されていない拡張機能を読み込む** で `chrome-extension/` を選択

接続先バックエンドは `chrome-extension/src/infrastructure/env.ts` で設定します
（既定は `wss://d-party.net`。ローカル開発スタックへ向ける場合は `localhost/` / `http://` / `ws://`）。
詳細は [`chrome-extension/README.md`](chrome-extension/README.md) を参照してください。

## 環境設定（dev / prod の出し分け）

環境固有の設定は **3 つの env ファイル**に分割し、Docker Compose のオーバーレイで
dev / prod を切り替えます。

| ファイル      | 用途           | 主なキー                                                            |
| ------------- | -------------- | ------------------------------------------------------------------- |
| `.env.global` | dev / prod 共有 | `POSTGRES_*` · `*_UPSTREAM` · `TZ` · `D_ANIME_STORE_DOMAIN`          |
| `.env.dev`    | 開発のみ       | `DEBUG=1` · `MY_DOMAIN=localhost` · `NEXT_PUBLIC_*`（http / ws）     |
| `.env.prod`   | 本番のみ       | `DEBUG=0` · `MY_DOMAIN=d-party.net` · `CERTBOT_EMAIL` · `NEXT_PUBLIC_*`（https / wss） |

> 環境固有値（`DEBUG` / `MY_DOMAIN` など）は **`.env.global` に置かないこと**。
> backend の `manage.py` が `/env_files/.env.global` を `override=True` で読み込むため、
> ここに残すと本番起動時に dev 値で上書きされてしまいます。

### 開発モード（既定）

```bash
docker compose up -d
```

`docker-compose.override.yml` が自動的に読み込まれ、

- **frontend** は `node` イメージで `pnpm dev`（Turbopack HMR）。`frontend/` をマウントして
  ホットリロードが効きます。
- `.env.dev` が適用され、`DEBUG=1` / `localhost` / http・ws 接続になります。

> 初回は frontend コンテナ内で `pnpm install` と初回コンパイルが走るため、起動完了まで
> 数分かかります（ヘルスチェック猶予 3 分）。

### 本番モード

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    --profile letsencrypt up -d
```

- **frontend** は `Dockerfile` で standalone ビルドを配信（`NEXT_PUBLIC_*` はビルド時に焼き込み）。
- **nginx** が TLS 終端（`nginx.prod.conf` + `nginx/templates-prod/`）。
- **certbot** が証明書を自動更新（`--profile letsencrypt` のときだけ起動）。
- `.env.prod` が適用され、`DEBUG=0` / `d-party.net` / https・wss 接続になります。

## 本番デプロイ（TLS / Let's Encrypt）

本番は nginx の TLS 終端と certbot（webroot / http-01）による証明書の
**自動取得・自動更新**に対応しています。

1. `.env.prod` の `MY_DOMAIN`（既定 `d-party.net`）と `CERTBOT_EMAIL` を実値に設定する。
2. 対象ドメインの DNS がこのホストを指し、ポート 80 / 443 が開いていること。
3. 初回証明書をブートストラップする（まず staging で疎通確認してから本番へ）:

   ```bash
   ./init-letsencrypt.sh --staging      # テスト証明書（レート制限なし）
   ./init-letsencrypt.sh --production   # 本番証明書
   ```

4. 通常起動（certbot の自動更新込み）:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml \
       --profile letsencrypt up -d
   ```

certbot は 12 時間ごとに `renew` を試み（失効 30 日前から更新）、nginx は 6 時間ごとに
reload して新しい証明書を取り込みます。証明書・秘密鍵は `./certbot/`（gitignore 済み）に
保存されます。

## URL 一覧（ローカル backend 起動時）

| 内容                           | URL                   |
| ------------------------------ | --------------------- |
| アプリ（Nginx 経由）           | http://localhost      |
| Django（直接 / debug-toolbar） | http://localhost:8000 |
| Prometheus                     | http://localhost:9090 |

> PostgreSQL の閲覧・操作は Adminer を廃止し、**VSCode の SQLTools 拡張**へ移行しました。
> Dev Container に SQLTools + PostgreSQL ドライバを同梱し、`d-party (compose postgres)` 接続を
> 事前定義済みです。`docker compose up -d` 後、SQLTools サイドバーから接続するだけで開けます
> （追加設定不要。接続先は `localhost:5432` / DB・ユーザー `d_party`）。

> 本番は nginx の TLS 終端により https://d-party.net（http は https へリダイレクト）で配信されます。

## 負荷試験（WebSocket 同時視聴）

[k6](https://k6.io/) で、組み上がったスタック（nginx → django(daphne) → Redis / PostgreSQL）に対する
WebSocket 同時視聴の負荷試験を `loadtest/` に用意しています。compose の `loadtest` profile に
隔離してあるため、通常の `docker compose up` には影響しません。

```bash
# 1. まずスタックを起動（dev 既定）
docker compose up -d

# 2. スモーク（1 ルーム×3 人、30 秒）
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# 3. スケール例（20 ルーム×5 人 = 100 接続、2 分）
LOADTEST_VUS=20 LOADTEST_ROOM_SIZE=5 LOADTEST_DURATION=2m \
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6
```

- 結果サマリは `loadtest/results/summary.json`（gitignore）に出力されます。
- 主なパラメータ（`LOADTEST_*` env）と Grafana/Prometheus 連携、計測メトリクスの詳細は
  [`loadtest/README.md`](loadtest/README.md) を参照してください。
- 既定の接続先は nginx 経由（本番に近い経路）。nginx/frontend を介さず django を直接叩く場合は
  `LOADTEST_TARGET=ws://django:8000/anime-store/party/` を指定します。

## サブモジュールの扱い

```bash
# 全サブモジュールを最新の追跡ブランチ(main)へ更新
git submodule update --remote --merge

# 特定サブモジュールだけ更新
git submodule update --remote backend

# サブモジュール内で作業するときは、そのディレクトリで通常どおり commit / push する。
# サブモジュールのコミットを進めたら、この monorepo 側で参照を更新してコミットする:
git add backend chrome-extension
git commit -m "chore: bump submodules"
```

各サブモジュールは個別のリポジトリです。**サービスのコード変更は各サブモジュール内で
ブランチを切り、それぞれのリポジトリへ PR を出してください。** この monorepo は
サブモジュールの参照（コミット SHA）と開発環境の設定のみを管理します。

## Dev Container

`.devcontainer/` に VS Code Dev Containers 用の設定を同梱しています。
VS Code でフォルダを開き **Dev Containers: Reopen in Container** を選ぶと、
Python 3.13 / uv / Node.js / pnpm / Docker-in-Docker / GitHub CLI / k6 / helm / k3d などが
揃った Linux 開発環境が立ち上がります。

## VS Code ワークスペース

[`d-party.code-workspace`](d-party.code-workspace) を開くと、monorepo ルートと
各サブモジュールがマルチルートワークスペースとして展開されます。

## ライセンス

各サブモジュールのライセンスに従います（いずれも MIT License）。
