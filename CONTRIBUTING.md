# Contributing to d-party

d-party は **monorepo** です。サーバ・拡張機能・フロントエンド・インフラ設定が
すべてこの 1 リポジトリに入っています。
貢献の前にこのドキュメントとルートの [AGENTS.md](AGENTS.md) を読んでください。

## 目次

- [リポジトリ構成](#リポジトリ構成)
- [開発フロー](#開発フロー)
- [monorepo での作業](#monorepo-での作業)
- [ブランチ命名](#ブランチ命名)
- [コミットメッセージ](#コミットメッセージ)
- [開発環境のセットアップ](#開発環境のセットアップ)

---

## リポジトリ構成

| パス         | 中身                       |
| ------------ | -------------------------- |
| `backend/`   | Django バックエンド        |
| `extension/` | ブラウザ拡張機能           |
| `frontend/`  | ユーザー向けフロントエンド |
| `infra/`     | k3s (Raspberry Pi) デプロイ設定 |
| `loadtest/`  | k6 による WebSocket 負荷試験 |
| ルート直下   | docker compose · nginx · postgres · redis · prometheus · grafana の設定 |

> かつては backend / chrome-extension / frontend を Git サブモジュールとして束ねた
> 「疑似 monorepo」でした。各リポジトリの履歴ごと取り込んで統合済みです。
> 旧 `chrome-extension/` は `extension/`、旧 `deploy/` は `infra/` です。
> `git submodule` 系のコマンドはもう使いません。

`extension/` と `frontend/` は **pnpm workspace** の 2 パッケージで、
ロックファイルはルートの `pnpm-lock.yaml` 1 本です。

---

## 開発フロー

このプロジェクトは **GitHub Flow** を採用しています。

1. `main` は常にデプロイ可能な状態を保つ。
2. すべての変更は `main` からブランチを切る。
3. ブランチへ commit / push し、`main` に対して **Pull Request** を出す。
4. 最低 1 人のレビュー承認後にマージする。
5. マージ後はブランチを削除する。
6. **`main` へ直接コミットしない。**

---

## monorepo での作業

サーバとフロントエンドと拡張機能にまたがる変更も、**1 本のブランチ・1 本の PR**で出します。

```bash
git checkout main
git pull
git checkout -b feature/your-change

# どのディレクトリも直接編集してよい
$EDITOR backend/streamer/consumers.py
$EDITOR extension/src/application/RoomSession.ts

git commit -m "feat: ..."
git push -u origin feature/your-change
# → d-party/d-party で PR を出す
```

### 気をつけること

- **JS の依存は必ずリポジトリのルートで入れる。**
  `cd frontend && pnpm install` のようなパッケージ内での install はしないでください
  （workspace 全体が再解決され、ロックファイルが意図せず動きます）。

  ```bash
  pnpm install                                   # 全体
  pnpm --filter d-party-frontend add some-lib    # frontend へ依存を追加
  ```

- **ロックファイルはルートの `pnpm-lock.yaml` 1 本だけ。**
  パッケージの下に `pnpm-lock.yaml` や `pnpm-workspace.yaml` を作らないでください。

- **ワークフローはルートの `.github/workflows/` にしか置けない。**
  GitHub は入れ子の `.github/workflows/` を読みません。

- **バージョンは手で上げない。**
  `release` ワークフローが全パッケージを同じ値へ揃えてタグを打ちます。

### PR を出す前に回すゲート

CI と同じものを手元で回せます。

```bash
# extension + frontend（turbo が変更のないタスクは飛ばす）
pnpm run api:generate && pnpm run typecheck && pnpm run lint && pnpm run build

# backend
cd backend
uv run ruff format --check . && uv run ruff check .
uv run mypy .
uv run pytest

# インフラ（chart を触ったとき）
helm lint infra/helm/d-party
```

`pre-commit install` を一度しておくと、backend の ruff と基本的な整形が
コミット時に自動で走ります（ルートで実行してください）。

---

## ブランチ命名

小文字 kebab-case。

| 目的         | パターン                      | 例                        |
| ------------ | ----------------------------- | ------------------------- |
| 新機能       | `feature/<short-description>` | `feature/add-room-limit`  |
| バグ修正     | `fix/<short-description>`     | `fix/websocket-reconnect` |
| 設定・依存   | `chore/<short-description>`   | `chore/bump-django`       |
| ドキュメント | `docs/<short-description>`    | `docs/update-readme`      |

---

## コミットメッセージ

**Conventional Commits を推奨**（必須ではない）。命令形（imperative mood）で書くこと。

```
feat:      新機能
fix:       バグ修正
chore:     ツール・依存・設定（本番コードの変更なし）
docs:      ドキュメントのみ
test:      テストの追加・更新
refactor:  バグ修正でも機能追加でもないコード変更
ci:        CI/CD 設定の変更
```

monorepo なので、どこを触ったかが分かるようスコープを付けると読みやすくなります
（例: `feat(extension): ...` / `fix(backend): ...` / `ci: ...`）。

---

## 開発環境のセットアップ

詳細は [README.md](README.md) を参照。最小手順:

```bash
git clone git@github.com:d-party/d-party.git
cd d-party

pnpm install              # extension + frontend
(cd backend && uv sync)   # backend
pre-commit install        # ルートで実行する

# スタックを起動（初回は README の migrate 手順を参照）
docker compose up -d
```

推奨: `.devcontainer/` の Dev Container を使うと必要なツールが一括で揃い、
上の 3 つのセットアップコマンドも自動で走ります。
