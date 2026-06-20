# Contributing to d-party

d-party は複数の Git サブモジュールを束ねた **疑似 monorepo** です。
貢献の前にこのドキュメントとルートの [AGENTS.md](AGENTS.md) を読んでください。

## 目次

- [リポジトリ構成](#リポジトリ構成)
- [開発フロー](#開発フロー)
- [サブモジュールでの作業](#サブモジュールでの作業)
- [ブランチ命名](#ブランチ命名)
- [コミットメッセージ](#コミットメッセージ)
- [開発環境のセットアップ](#開発環境のセットアップ)

---

## リポジトリ構成

| パス | サービス | 上流リポジトリ |
|---|---|---|
| `backend/` | Django バックエンド | [d-party-Backend](https://github.com/d-party/d-party-Backend) |
| `chrome-extension/` | Chrome 拡張機能 | [d-party-Chrome-Extensions](https://github.com/d-party/d-party-Chrome-Extensions) |

**このルートリポジトリが管理するのは、サブモジュールの参照と開発環境の設定のみです。**
サービスの実装コードは各サブモジュール（上流リポジトリ）にあります。

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

## サブモジュールでの作業

**サービスのコードを変更する場合は、必ず該当サブモジュール内で作業します。**

```bash
# 1. サブモジュールに入り、最新の main を取得
cd backend
git checkout main
git pull

# 2. 作業ブランチを切る
git checkout -b feature/your-change

# 3. 変更・コミット・プッシュ（上流リポジトリへ）
git commit -m "feat: ..."
git push -u origin feature/your-change
# → 上流リポジトリ (d-party-Backend) で PR を出す
```

サブモジュールのコミットが進んだら、ルートリポジトリ側で参照を更新します。

```bash
cd ..                                   # monorepo ルートへ
git add backend                         # 進めたサブモジュールの参照を追加
git commit -m "chore: bump backend submodule"
```

全サブモジュールを追跡ブランチ（`main`）の最新へ揃える場合:

```bash
git submodule update --remote --merge
```

---

## ブランチ命名

各サブモジュール内で以下の規則を用います（小文字 kebab-case）。

| 目的 | パターン | 例 |
|---|---|---|
| 新機能 | `feature/<short-description>` | `feature/add-room-limit` |
| バグ修正 | `fix/<short-description>` | `fix/websocket-reconnect` |
| 設定・依存 | `chore/<short-description>` | `chore/bump-django` |
| ドキュメント | `docs/<short-description>` | `docs/update-readme` |

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

---

## 開発環境のセットアップ

詳細は [README.md](README.md) を参照。最小手順:

```bash
# サブモジュールごとクローン
git clone --recurse-submodules git@github.com:d-party/d-party.git
cd d-party

# すでにクローン済みなら
git submodule update --init --recursive

# バックエンドを起動（初回は README の migrate 手順を参照）
cd backend && docker compose up -d
```

推奨: `.devcontainer/` の Dev Container を使うと必要なツールが一括で揃います。
