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
| `backend/`          | Django バックエンド | Python 3.11 · Django 4 · Channels · DRF · MySQL 8 · Redis 7 · Nginx | [d-party-Backend](https://github.com/d-party/d-party-Backend)                     |
| `chrome-extension/` | Chrome 拡張機能     | Manifest V3 · Vanilla JS · jQuery 3.6                               | [d-party-Chrome-Extensions](https://github.com/d-party/d-party-Chrome-Extensions) |

両サブモジュールとも `main` ブランチを追跡（`.gitmodules`）。

### Request / data flow

```
Chrome 拡張機能 (dアニメストアのページに content script を注入)
        │  WebSocket (wss://d-party.net, 既定)
        ▼
Nginx :80/443 ──▶ Django (daphne/uvicorn, Channels)
        ├─ REST API (DRF)            : /api/*
        ├─ WebSocket (Channels)      : 同時視聴の同期
        └─ 管理画面 (Jazzmin)        : /admin/*
Django ──▶ MySQL 8（永続化） / Redis 7（Channels レイヤ・キャッシュ）
監視: Prometheus + Grafana + cadvisor + node-exporter（django-prometheus 経由）
```

## backend/（Django）

```
backend/
  docker-compose.yml      nginx · django · mysql · redis · phpmyadmin · prometheus · grafana · cadvisor · node-exporter
  Django/
    d_party/              プロジェクト設定 (settings.py, asgi.py, urls.py)
    streamer/             同時視聴の WebSocket consumers / cron / models
    api/                  DRF REST API (views, urls)
    web/                  テンプレート・静的ファイル配信
    pyproject.toml        Poetry 依存定義
    Dockerfile            python:3.11 + Poetry
  MySQL/ Redis/ nginx/ prometheus/ grafana/   各サービス設定
```

- 依存管理は **Poetry**（`backend/Django/pyproject.toml`）。
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

### backend（`cd backend`）

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

# テスト / 静的解析（コンテナ内で実行）
docker compose exec django pytest --cov
docker compose exec django pip-licenses
docker compose exec django pipdeptree --graph-output dot > dependencies.dot
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
| `http://localhost:8080` | phpMyAdmin                          |
| `http://localhost:9090` | Prometheus                          |

> 外部サービス（Google 等）は bot 検出でブロックされることがある。外部調査には
> `WebSearch` / `WebFetch` を優先し、ブラウザ検証は localhost に集中させること。
