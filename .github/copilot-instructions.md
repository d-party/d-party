# Copilot Instructions — d-party

## Repository overview

このリポジトリは **monorepo** です。サーバ・拡張機能・フロントエンド・インフラ設定が
すべてここに入っています。全体のアーキテクチャ・規約・コマンドは
[AGENTS.md](../AGENTS.md) を参照してください。

| パス         | 中身                                 |
| ------------ | ------------------------------------ |
| `backend/`   | Django（Channels / DRF）             |
| `extension/` | ブラウザ拡張機能（Manifest V3 / rspack） |
| `frontend/`  | Next.js                              |
| `infra/`     | k3s (Raspberry Pi) の Helm chart     |
| `loadtest/`  | k6 による WebSocket 負荷試験          |

## 約束ごと（最重要）

- **サブモジュールは無い。** `git submodule` 系のコマンドは使わない。
  どのディレクトリのコードもこのリポジトリで直接変更してコミットする。
  複数ディレクトリにまたがる変更も 1 本の PR で出す。
- **JS の依存はルートで入れる。** `extension/` と `frontend/` は pnpm workspace の
  パッケージで、ロックファイルはルートの `pnpm-lock.yaml` 1 本だけ。
  パッケージ内で `pnpm install` しない。追加は `pnpm --filter <pkg> add <dep>`。
  パッケージ名は `d-party-chrome-extension` と `d-party-frontend`
  （ディレクトリ名と一致しないので注意）。
- **ワークフローはルートの `.github/workflows/` にしか置けない。**
  GitHub は入れ子の `.github/workflows/` を読まない。
- **バージョンは手で上げない。** `release` ワークフローが全パッケージを同じ値へ
  揃えてタグを 1 本打つ。
- **frontend の Docker ビルドコンテキストはルート**（`-f frontend/Dockerfile .`）。
  pnpm workspace のロックファイルがルートにあるため。

## よく使うコマンド

```bash
pnpm run typecheck && pnpm run lint && pnpm run build   # extension + frontend（turbo 経由）
cd backend && uv run pytest && uv run mypy .            # backend
helm lint infra/helm/d-party                            # インフラ
```
