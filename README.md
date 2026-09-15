# d-party

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**dアニメストアで「同時視聴」を実現する d-party プロジェクトの monorepo です。**

サーバ・拡張機能・フロントエンド・インフラ設定がすべてこの 1 リポジトリに入っています。
以前は 3 つの Git サブモジュールを束ねた「疑似 monorepo」でしたが、各リポジトリの履歴ごと
取り込んで本物の monorepo になりました（`git log` / `git blame` は移行前まで辿れます）。

## 構成

| パス           | 中身                       | スタック                                                                          |
| -------------- | -------------------------- | --------------------------------------------------------------------------------- |
| `backend/`     | Django バックエンド        | Python 3.14 · Django 6 · Channels · DRF · PostgreSQL 16 · Redis 7                  |
| `extension/`   | ブラウザ拡張機能           | Manifest V3 · TypeScript · React 19 · rspack · Tailwind CSS v4 · shadcn/ui         |
| `frontend/`    | ユーザー向けフロントエンド | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui                   |
| `infra/`       | k3s (Raspberry Pi) デプロイ | Helm chart · Argo CD · rootless BuildKit · クラスタ共有基盤                        |
| `loadtest/`    | WebSocket 負荷試験         | k6                                                                                |
| `nginx/` ほか  | オーケストレーション       | docker compose · nginx · postgres · redis · prometheus · grafana                  |

> `extension/` は旧 `chrome-extension/`。Manifest V3 は Edge など Chromium 系ブラウザでも
> そのまま読み込めるため、ブラウザ名を含まない名前にしています。
> `infra/` は旧 `deploy/` です。

`extension/` と `frontend/` は **pnpm workspace** の 2 パッケージで、ロックファイルは
ルートの `pnpm-lock.yaml` 1 本です。ビルド・lint・型検査のオーケストレーションは
[Turborepo](https://turborepo.com/)（`turbo.json`）が行います。

## 必要要件

- **Docker** + Docker Compose v2（フルスタック起動に必須）
- **Chromium 系ブラウザ**（拡張機能の動作確認用）
- 個別に手元で動かす場合:
  - **Python 3.14** + [uv](https://docs.astral.sh/uv/)（backend）
  - **Node.js 26** + [pnpm](https://pnpm.io/) 10（extension / frontend）

> 推奨: 後述の [Dev Container](#dev-container) を使うと上記ツールが一括で揃います。

## クイックスタート

### 1. クローン

```bash
git clone git@github.com:d-party/d-party.git
cd d-party
```

サブモジュールは無くなったので `--recurse-submodules` は不要です。

### 2. 依存を入れる

```bash
pnpm install              # extension + frontend（ルートで 1 回）
(cd backend && uv sync)   # backend
pre-commit install        # backend 向けのフック（ルートで実行する）
```

### 3. スタックを起動

docker compose はこのリポジトリのルートにあります。初回は Django の migrate と
collectstatic が必要です。

```bash
docker compose build --no-cache
docker compose up -d
# migration ファイルはコミット済みなので migrate のみでよい
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic
```

2 回目以降は `docker compose up -d` だけで起動できます。これは **開発モード**で、
frontend は `pnpm dev`（HMR）として立ち上がります。dev / prod の切り替えと環境変数は
[環境設定（dev / prod の出し分け）](#環境設定dev--prod-の出し分け)を参照してください。

### 4. 拡張機能を読み込む

```bash
pnpm --filter d-party-chrome-extension build
```

1. ブラウザで `chrome://extensions`（Edge は `edge://extensions`）を開く
2. **デベロッパーモード** を有効化
3. **パッケージ化されていない拡張機能を読み込む** で `extension/dist/` を選択

接続先バックエンドは `extension/src/infrastructure/env.ts` で設定します
（既定は `wss://d-party.net`。ローカル開発スタックへ向ける場合は `localhost/` / `http://` / `ws://`）。
詳細は [`extension/README.md`](extension/README.md) を参照してください。

## よく使うコマンド

ルートの `package.json` から Turborepo 経由で両パッケージをまとめて回せます。
`turbo` が依存関係（`api:generate` → `lint` / `typecheck` / `build`）と出力キャッシュを
管理するため、変わっていないタスクは再実行されません。

```bash
pnpm run api:generate     # OpenAPI から REST クライアントを生成
pnpm run typecheck        # tsc --noEmit（両パッケージ）
pnpm run lint             # eslint（両パッケージ）
pnpm run build            # extension の rspack + frontend の next build
pnpm run build-storybook  # 両パッケージの Storybook
pnpm run license:check    # 依存ライセンスの許可リスト検査

# 片方だけ回す
pnpm --filter d-party-frontend run build
turbo run lint --filter=d-party-chrome-extension
```

backend は Python なので workspace の外です。

```bash
cd backend
uv run pytest
uv run mypy .
uv run ruff check .
```

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

- **frontend** は `node` イメージで `pnpm dev`（Turbopack HMR）。pnpm workspace の
  ロックファイルがルートにあるため、コンテナにはリポジトリ全体をマウントし、
  `--filter d-party-frontend...` で frontend の依存だけを入れます。
- `.env.dev` が適用され、`DEBUG=1` / `localhost` / http・ws 接続になります。

> 初回は frontend コンテナ内で `pnpm install` と初回コンパイルが走るため、起動完了まで
> 数分かかります（ヘルスチェック猶予 3 分）。

### 本番モード

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    --profile letsencrypt up -d
```

- **frontend** は `frontend/Dockerfile` で standalone ビルドを配信
  （`NEXT_PUBLIC_*` はビルド時に焼き込み）。ビルドコンテキストは **ルート**です。
- **nginx** が TLS 終端（`nginx.prod.conf` + `nginx/templates-prod/`）。
- **certbot** が証明書を自動更新（`--profile letsencrypt` のときだけ起動）。
- `.env.prod` が適用され、`DEBUG=0` / `d-party.net` / https・wss 接続になります。

## 本番デプロイ

本番の想定は 2 系統あります。

### A. docker compose + Let's Encrypt（単一ホスト）

nginx の TLS 終端と certbot（webroot / http-01）による証明書の**自動取得・自動更新**。

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

### B. k3s (Raspberry Pi) + Helm + Argo CD

Raspberry Pi で組んだ k3s クラスタへ Helm chart をデプロイし、CD は Argo CD（GitOps）。
ドメイン解決と TLS は Cloudflare Tunnel がエッジで終端します。
設定一式は [`infra/`](infra/README.md) にあります。

リリースは GitHub Actions の `release` ワークフロー（`workflow_dispatch`）1 本で完結します:
全パッケージの version を揃えてタグを打ち、backend / frontend の arm64 イメージを
GHCR へ push し、拡張機能を Chrome Web Store へ upload します。GHCR に上がった
`vX.Y.Z` タグを argocd-image-updater が拾い、Argo CD がローリング更新します。

## URL 一覧（ローカル起動時）

| 内容                 | URL                   |
| -------------------- | --------------------- |
| アプリ（Nginx 経由） | http://localhost      |
| Django（直接）       | http://localhost:8000 |
| Prometheus           | http://localhost:9090 |

> PostgreSQL の閲覧・操作は Adminer を廃止し、**VSCode の SQLTools 拡張**へ移行しました。
> Dev Container に SQLTools + PostgreSQL ドライバを同梱し、`d-party (compose postgres)` 接続を
> 事前定義済みです。`docker compose up -d` 後、SQLTools サイドバーから接続するだけで開けます
> （追加設定不要。接続先は `localhost:5432` / DB・ユーザー `d_party`）。

> Redis（Channels レイヤ・キャッシュ）の閲覧は **VSCode の Redis 拡張（Redis for VS Code）** を
> Dev Container に同梱しています。この拡張は接続情報を settings.json で事前定義できないため、
> 初回のみサイドバーの Redis アイコン →「+ Connect database」で `127.0.0.1:6379`（フォームの既定値の
> まま）を登録してください。以降は拡張側に保存され、再接続の操作は不要です。

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

## 開発フロー

**GitHub Flow** です。`main` から短命なブランチを切り、`main` に対して PR を出します。
monorepo になったので、backend と frontend にまたがる変更も **1 本の PR** で出せます。
詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## CI

ワークフローはルートの `.github/workflows/` に集約されています。
`paths` フィルタで、触ったディレクトリに対応するものだけが回ります。

| ワークフロー             | name              | 対象                                                          |
| ------------------------ | ----------------- | ------------------------------------------------------------- |
| `backend-ci.yml`         | `Backend/CI`      | ruff · pytest · mypy · license · dockerlint · hadolint · dockle |
| `frontend-ci.yml`        | `Frontend/CI`     | turbo lint/typecheck/build/storybook · license · イメージ疎通 |
| `extension-ci.yml`       | `Extension/CI`    | turbo lint/typecheck/build/storybook · license                |
| `infra-ci.yml`           | `Infra/CI`        | helm lint · helm template                                     |
| `nginx-ci.yml`           | `Nginx/CI`        | nginx テンプレートの構文チェック                               |
| `repo-ci.yml`            | `Repo/CI`         | actionlint · shellcheck · yamllint                            |
| `repo-codeql.yml`        | `Repo/CodeQL`     | CodeQL（python / javascript-typescript）                       |
| `repo-review.yml`        | `Repo/Review`     | reviewdog で PR へインラインコメント                           |
| `storybook-deploy.yml`   | `Storybook/Deploy`| 両 Storybook を GitHub Pages のサブパスへ公開                  |
| `release.yml`            | `Release`         | 統一リリース（手動実行）                                       |

依存のキャッシュはロックファイルのハッシュをキーにしています。pnpm ストアは
`actions/setup-node` の `cache: pnpm`（`pnpm-lock.yaml`）、Python は
`astral-sh/setup-uv` の `cache-dependency-glob`（`backend/uv.lock`）、Turborepo の
ローカルキャッシュと Next.js の `.next/cache` は `actions/cache` で
`hashFiles('pnpm-lock.yaml')` を主キーに持ち越します。

## Dev Container

`.devcontainer/` に VS Code Dev Containers 用の設定を同梱しています。
VS Code でフォルダを開き **Dev Containers: Reopen in Container** を選ぶと、
Python 3.14 / uv / Node.js 26 / pnpm / Docker-in-Docker / GitHub CLI / k6 / helm / k3d などが
揃った Linux 開発環境が立ち上がり、`uv sync` と `pnpm install` と `pre-commit install` まで
自動で走ります。

## VS Code ワークスペース

[`d-party.code-workspace`](d-party.code-workspace) を開くと、ルートと各パッケージが
マルチルートワークスペースとして展開されます。monorepo なので単一ルートで開いても
問題ありませんが、こちらの方が言語サーバの設定が混ざりにくくなります。

## ライセンス

MIT License。
