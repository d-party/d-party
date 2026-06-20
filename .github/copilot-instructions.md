# Copilot Instructions — d-party

## Repository overview

このリポジトリは複数の Git サブモジュールを束ねた **疑似 monorepo** です。
全体のアーキテクチャ・規約・コマンドは [AGENTS.md](../AGENTS.md) を参照してください。

## サブモジュールの扱い（最重要）

- サービスのコードは `backend/` と `chrome-extension/` の **サブモジュール内** にある。
- コード変更は必ず該当サブモジュール内でブランチを切り、各上流リポジトリへ PR を出す。
- このルートリポジトリでコミットするのは **サブモジュール参照（SHA）と開発設定だけ**。
- `backend/` や `chrome-extension/` 内のファイルをルート側で直接書き換えてコミットしないこと。
