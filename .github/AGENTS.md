# AGENTS.md — CI / リリース

ワークフローはすべて `workflows/` に置く。`paths` フィルタで、触ったディレクトリの分だけが回る。

| ワークフロー | name | 内容 | paths |
| --- | --- | --- | --- |
| `backend-ci.yml` | `Backend/CI` | ruff · pytest · mypy · openapi（`openapi.json` の drift）· license-check | `backend/**` + 契約テストが読む TypeScript（`protocol.ts` · `reactions.ts` · `StatsDashboard.tsx`） |
| `backend-build.yml` | `Backend/Build` | hadolint · build → dockle → migrate → 起動 → API 応答 | `backend/**` |
| `frontend-ci.yml` | `Frontend/CI` | 生成物の drift · typecheck · lint · license-check | `frontend/**` `packages/**` `backend/openapi.json` + workspace 設定 |
| `frontend-build.yml` | `Frontend/Build` | next build · storybook · イメージ build → 起動 → ページ疎通 | 同上 |
| `extension-ci.yml` | `Extension/CI` | 生成物の drift · typecheck · lint · license-check | `extension/**` `packages/**` `backend/openapi.json` + workspace 設定 |
| `extension-build.yml` | `Extension/Build` | build:prod（manifest の参照先の実在確認）· zip · storybook | 同上 |
| `infra-ci.yml` | `Infra/CI` | helm lint · helm template | `infra/**` |
| `nginx-ci.yml` | `Nginx/CI` | nginx テンプレートの構文チェック | `nginx/**` |
| `repo-ci.yml` | `Repo/CI` | actionlint · shellcheck · yamllint · CodeQL | 全体 |
| `repo-badge.yml` | `Repo/Badge` | PR が触ったパスからラベル `Backend` `Frontend` `Extension` `Infra` を付け外しする（対応表は `labeler.yml`） | PR 全体 |
| `storybook-deploy.yml` | `Storybook/Deploy` | 両 Storybook を GitHub Pages の `/extension/` `/frontend/` へ | main のみ |
| `release.yml` | `Release` | 統一リリース | 手動 |
| `maintenance.yml` | `Repo/Maintenance` | Claude Code が `dependabot-review-and-merge` で判定（読み取り専用）→ `scripts/dependabot-merge.sh` がマージ → `scripts/weekly-release.sh` がリリース | 毎週火曜 10:00 JST・手動 |

- `name` は `<Scope>/<Kind>`。`CI` は lint・型・テスト、`Build` は出荷物が組み上がって動くか。
- actionlint は reviewdog の `fail_level: any` で、指摘があれば失敗させる（既定の `none` は成功扱いになる）。
- CI と Dependabot の対象ブランチは `main`。
- 依存のコード（`pnpm install` · `uv sync` の後の build · test · start）を動かすジョブには書き込み権限を
  渡さない（`permissions: contents: read`、checkout は `persist-credentials: false`）。投稿やマージが要るなら、
  依存を動かさない別ジョブに分けて結果を artifact で渡す（例: `backend-ci.yml` の `coverage`、
  `maintenance.yml` の `merge`、`release.yml` の `extension-publish`）。
- 書き込み権限を持つジョブに、PR や issue の本文のような誰でも書けるテキストを読む LLM を置かない。
- ワークフローから呼ぶシェルスクリプトは `scripts/` に置く。

## キャッシュ

キーはロックファイルのハッシュ。ロックファイルが変わったら作り直す。

| 対象 | 仕組み | キー |
| --- | --- | --- |
| pnpm ストア | `setup-node` の `cache: pnpm` | `pnpm-lock.yaml` |
| uv | `setup-uv` の `enable-cache` | `backend/uv.lock` |
| `.turbo` | `actions/cache` | `turbo-<os>-<workflow>-<job>-<lock hash>-<sha>` |
| `frontend/.next/cache` | `actions/cache` | `next-<os>-<lock hash>-<sha>` |

Actions のキャッシュは同じキーへ上書きできない。turbo のキーにワークフロー名とジョブ名を
入れているのは、ジョブ同士で取り合わないようにするため。

main のキャッシュは release.yml のビルドも復元する。main の権限で走り、未レビューの依存の
コードを動かすジョブ（`maintenance.yml` の `review`）は `cache-mode: read` にして、キャッシュを
書き換えられないようにする。キャッシュを使わない書き込み権限のジョブは `cache-mode: none`。
`cache-mode` をこの版の actionlint はまだ知らないので、`actionlint.yaml` でその指摘だけ外している。

## リリース（`release.yml`）

1. 最新タグ `vX.Y.Z` と `bump_type` から次の版を決める。
2. `backend/pyproject.toml` · `extension/package.json` · `extension/public/manifest.json` ·
   `frontend/package.json` · `packages/ui/package.json` · ルートの `package.json` を書き換えて
   main へコミットし、タグと GitHub Release を作る。
3. backend / frontend を amd64・arm64 のネイティブランナーで並列ビルドし、ダイジェストだけを
   push する。`manifest` ジョブが `imagetools create` で 1 つのタグ
   （`ghcr.io/d-party/{backend,frontend}:vX.Y.Z`）にまとめる。k3s では argocd-image-updater が拾う。
4. 拡張機能の zip を Release に添付し、Chrome Web Store へ upload する（`publish` が true なら公開まで）。
   ビルド（`extension-build`）と公開（`extension-publish`）はジョブを分ける。Chrome Web Store の
   secrets と `contents: write` は、pnpm を動かさない `extension-publish` にだけ渡す。

## リポジトリ側で 1 度だけ要る設定

| 何 | どこ | 未設定だと |
| --- | --- | --- |
| Pages のソースを GitHub Actions にする | Settings → Pages（`gh api -X POST repos/<owner>/<repo>/pages -f build_type=workflow`） | `Storybook/Deploy` の deploy が 404 で落ちる |
| GHCR パッケージへの Write を許可する | `ghcr.io/d-party/{backend,frontend}` の Package settings → Manage Actions access | `Release` の images ジョブが denied で落ちる |
| secret `CLAUDE_CODE_OAUTH_TOKEN` | `claude setup-token` の出力を Actions secrets へ | `Repo/Maintenance` が認証エラーで落ちる |
| Private vulnerability reporting | Settings → Security（`gh api -X PUT repos/<owner>/<repo>/private-vulnerability-reporting`） | `SECURITY.md` の報告先が使えない |
