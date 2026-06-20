# d-party

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**dアニメストアで「同時視聴」を実現する d-party プロジェクトの開発用 monorepo です。**

このリポジトリは複数の Git サブモジュールを束ねた **疑似 monorepo** です。
各サービスは独立したリポジトリとして管理されつつ、このリポジトリから一括で
クローン・開発できるようにまとめてあります。

## 構成

| パス | サービス | スタック | リポジトリ |
|---|---|---|---|
| `backend/` | Django バックエンド | Python 3.11 · Django 4 · Channels · DRF · MySQL · Redis · Nginx | [d-party-Backend](https://github.com/d-party/d-party-Backend) |
| `chrome-extension/` | Chrome 拡張機能 | Manifest V3 · Vanilla JS · jQuery 3.6 | [d-party-Chrome-Extensions](https://github.com/d-party/d-party-Chrome-Extensions) |

両サブモジュールは `main` ブランチを追跡しています（`.gitmodules` 参照）。

## 必要要件

- **Git** 2.13 以降（サブモジュール操作のため）
- **Docker** + Docker Compose v2（バックエンドのフルスタック起動に必須）
- **Google Chrome**（拡張機能の動作確認用）
- 個別サービスをローカル開発する場合:
  - **Python 3.11** + [Poetry](https://python-poetry.org/)（バックエンド）

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

初回は Django の migrate と collectstatic が必要です。

```bash
cd backend
docker compose build --no-cache
docker compose up -d
docker compose exec django python manage.py makemigrations
docker compose exec django python manage.py makemigrations streamer
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic
docker compose down
docker compose up -d
```

2 回目以降は `docker compose up -d` だけで起動できます。
詳細は [`backend/README.md`](backend/README.md) を参照してください。

### 3. Chrome 拡張機能を読み込む

1. Chrome で `chrome://extensions` を開く
2. **デベロッパーモード** を有効化
3. **パッケージ化されていない拡張機能を読み込む** で `chrome-extension/` を選択

接続先バックエンドは `chrome-extension/js/common/settings.js` で設定します
（既定は `wss://d-party.net`）。詳細は [`chrome-extension/README.md`](chrome-extension/README.md) を参照してください。

## URL 一覧（ローカル backend 起動時）

| 内容 | URL |
|---|---|
| アプリ（Nginx 経由） | http://localhost |
| Django（直接 / debug-toolbar） | http://localhost:8000 |
| phpMyAdmin | http://localhost:8080 |
| Prometheus | http://localhost:9090 |

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
Python 3.11 / Poetry / Docker-in-Docker / GitHub CLI などが揃った Linux 開発環境が
立ち上がります。

## VS Code ワークスペース

[`d-party.code-workspace`](d-party.code-workspace) を開くと、monorepo ルートと
各サブモジュールがマルチルートワークスペースとして展開されます。

## ライセンス

各サブモジュールのライセンスに従います（いずれも MIT License）。
