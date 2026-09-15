---
name: dependabot-review-and-merge
description: Review, verify and merge the open Dependabot PRs across the d-party submodules (backend / chrome-extension / frontend). Reads every intermediate release note for breaking changes, greps the codebase for the affected imports and APIs, runs the real test/build gates locally, and only then merges. Use when asked to handle, review, triage or merge dependency update PRs.
---

# Dependabot review & merge (d-party)

依存更新 PR を「CI が緑だから」でマージしない。**中間バージョンを含む全リリースノートを読み、
実際に使っている import / API を照合し、ローカルで動かして**から初めてマージする。

このリポジトリは疑似 monorepo。Dependabot PR は**各サブモジュールの上流リポジトリ**に立つ:

| submodule | upstream | 主なゲート |
| --- | --- | --- |
| `backend/` | `d-party/backend` | pytest · mypy · ruff · makemigrations --check |
| `chrome-extension/` | `d-party/chrome-extension` | typecheck · lint · rspack build · build-storybook |
| `frontend/` | `d-party/frontend` | typecheck · lint · next build · build-storybook · Docker smoke |

> サブモジュール内のコード変更は必ずそのサブモジュール内で行う。ルートリポジトリでは
> サブモジュール参照 (SHA) と開発設定しかコミットしない（AGENTS.md「サブモジュール運用ルール」）。

## 1. 棚卸し

```bash
for r in backend chrome-extension frontend; do
  echo "=== $r ==="
  gh pr list -R d-party/$r --author "app/dependabot" --state open \
    --json number,title,headRefName,mergeable,mergeStateStatus
done
```

各 PR の本文・変更ファイル・チェック結果を取得して保存する（本文に Dependabot が
release notes / commits を埋め込んでいる）:

```bash
gh pr view <N> -R d-party/<repo> --json number,title,body,files,statusCheckRollup,headRefOid
```

**最初に赤い PR を特定する。** 赤い PR は本物の破壊的変更を示していることが多く、
そこが一番読む価値のある情報源になる。`gh run view <id> -R <repo> --log-failed` で
実際のエラー行まで降りる。

## 2. 破壊的変更の調査（ここを省略しない）

major bump と、**minor でもフレームワーク本体**（Django の x.Y、Next.js、Vite 等）は
必ず一次情報を読む。Dependabot の PR 本文は commit 一覧だけのことがあるので、
WebFetch で公式の移行ガイド / CHANGELOG を取りに行く。

- Django: `https://docs.djangoproject.com/en/<X.Y>/releases/<X.Y>/`（backwards-incompatible + deprecations）
- Next.js: `https://nextjs.org/docs/app/guides/upgrading/version-<N>`
- Vite: `https://vite.dev/guide/migration`
- npm パッケージ一般: GitHub Releases、無ければ `raw.githubusercontent.com/<org>/<repo>/main/CHANGELOG.md`、
  または公式ドキュメントの migration ページ

**現在 → 目標の間の全バージョン**を見る。12.40.0 → 13.1.1 なら 13.0.0 の breaking と
13.1.0 / 13.1.1 の修正まで。途中の major を飛ばさない。

## 3. コードとの照合

読んだ breaking change を、**このリポジトリが実際に使っているか**で潰す。
「該当なし」を確認するまでが調査。

```bash
# 例: Django 6.1 の backwards-incompatible 項目を総当たりで潰す
grep -rnE "EMAIL_BACKEND|send_mail|RemoteUserMiddleware|select_related\(\)|values_list\(|JSONField|list_select_related|RawSQL|\.union\(" \
  --include=*.py . | grep -v "/.venv/\|/migrations/"

# 例: framer-motion v13 は @emotion/is-prop-valid の暗黙依存を削除しただけ
grep -rn "isValidProp\|is-prop-valid\|MotionConfig\|motion(" src/

# 例: import 形態が変わるもの（default export 廃止など）
grep -rn "from \"<package>\"" src/
```

DB / ランタイムの下限も見る（Django 6.1 は PostgreSQL 15+、Next 16 は Node 20.9+）。
`docker-compose.yml` と `deploy/helm/d-party/values.yaml` の実際のバージョンと突き合わせる。

## 4. ローカル検証

CI は **PR 単体**しか見ていない。付加価値は「**全部入れた最終状態**」を試すこと。

### backend

postgres / redis を立て、CI と同じ env を用意する（`CHROME_EXTENSION_REQUIRED_VERSION`
が無いと version-check テストが 406 で落ちるので必ず入れる）:

```bash
docker compose up -d postgres redis     # リポジトリルートで

cd backend
export SECRET_KEY=django-insecure-local-test DEBUG=1 MY_DOMAIN=localhost \
  D_ANIME_STORE_DOMAIN=animestore.docomo.ne.jp TIME_ZONE=Asia/Tokyo LANGUAGE_CODE=ja \
  DATABASE_ENGINE=django_prometheus.db.backends.postgresql DATABASE_USER=d_party \
  DATABASE_HOST=localhost DATABASE_PORT=5432 POSTGRES_DB=d_party POSTGRES_PASSWORD=password \
  REDIS_HOST=localhost REDIS_PORT=6379 CHROME_EXTENSION_REQUIRED_VERSION=1.0.0

uv sync --frozen --python 3.13
uv run pytest -q --create-db      # --create-db necessary: 古い test DB が残ると偽の失敗が出る
uv run python manage.py makemigrations --check --dry-run
uv run ruff check . && uv run ruff format --check . && uv run mypy .
```

**必ず control を取る。** 失敗を見たら、まず `origin/main` で同じコマンドを走らせて
「その失敗が bump 由来か、元から落ちているか」を切り分ける。切り分けずに
「依存が壊した」と報告しない。

### chrome-extension / frontend

全 PR を束ねた最終状態を作って検証する。lockfile は必ず衝突するので、
`package.json` を最終形にしてから再生成する:

```bash
cd frontend
git checkout -B verify-combined origin/main
git merge --no-edit origin/dependabot/npm_and_yarn/main/<group-branch>   # group はだいたい綺麗に入る
# 単体 PR は package.json の 1 行だけなので、その差分を確認して直接当てる
git diff origin/main...origin/dependabot/npm_and_yarn/main/<branch> -- package.json
# → 目標バージョンへ書き換えてから
pnpm install --no-frozen-lockfile

pnpm api:generate && git diff --exit-code -- src/infrastructure/api/generated
pnpm typecheck && pnpm lint && pnpm build && pnpm build-storybook
```

**ビルドが通っただけで終わらせない。** frontend は実際に起動して叩く:

```bash
PORT=3111 pnpm start &
for p in / /usage /qa /privacy /stats /anime-store/lobby/test-room-123 /nope; do
  curl -s -o /dev/null -w "$p %{http_code}\n" "http://127.0.0.1:3111$p"
done
# 拡張機能との DOM 契約が生きているか（これが壊れるとルーム遷移が死ぬ）
curl -s http://127.0.0.1:3111/anime-store/lobby/test/ | grep -o chrome_extension_field
# OG 画像（Satori + 日本語フォント）が実際に PNG を返すか
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  http://127.0.0.1:3111/anime-store/lobby/test/opengraph-image
```

## 5. 判定とマージ

`gh pr merge <N> -R d-party/<repo> --squash --delete-branch`（3 リポジトリとも squash 運用）。

**lockfile 衝突の連鎖に注意。** `package.json` / `pnpm-lock.yaml` を触る PR は互いに
衝突するので、1 つマージするたびに残りが DIRTY になる。手順:

1. 1 つマージする
2. 残りに `gh pr comment <N> -R <repo> --body "@dependabot rebase"`
3. `mergeable`/`mergeStateStatus` が `MERGEABLE`/`CLEAN` に戻るまでポーリング
4. rebase 後の **新しい commit で CI が緑になったことを確認**してから次をマージ

依存の記述箇所が離れていれば（`dependencies` と `devDependencies` など）衝突せず
そのままマージできることもある。毎回状態を見てから判断する。

## 6. 破壊的変更で落ちている PR の扱い

バージョン bump 単体ではビルドが通らない場合、**移行コードは bump と同じ PR に載せる**
（別 PR に分けると main が壊れる期間ができる）。Dependabot のブランチに直接
commit を push してよい（以後 Dependabot はその PR を更新しなくなるが、直後にマージするなら問題ない）。

```bash
cd <submodule>
git checkout -B fix-<pkg> origin/dependabot/npm_and_yarn/main/<branch>
git rebase origin/main            # 衝突は package.json を最終形にして pnpm install で lock 再生成
# 移行コードを当てる
# 依存 bump commit と移行 commit は分ける（dependabot の commit を汚さない）
git push --force-with-lease origin HEAD:dependabot/npm_and_yarn/main/<branch>
```

実例（lottie-react v2 → v3）: default export 廃止 + `animationData` → `src` +
`loop`/`autoplay` の既定値が `true` → `false`。呼び出し側が両方明示していれば
挙動は変わらない、というところまで確認して初めて「安全」と言える。

## 7. 報告

PR ごとに、**何を読んで・何を grep して・何を実行して・結果どうだったか**を書く。
- マージしたもの / 見送ったものと、その理由
- 破壊的変更のうち「該当なし」と判断した根拠
- 挙動が変わるが壊れてはいない点（要フォローアップ）は別立てで明示する

CI が緑でも挙動が変わるものは見逃されやすい。例: Next 16 は `scroll-behavior: smooth` を
ナビゲーション時に上書きしなくなった（`<html data-scroll-behavior="smooth">` が必要）、
`next build` が `tsconfig.json` を書き換える、など。
