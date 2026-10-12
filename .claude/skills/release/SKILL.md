---
name: release
description: Cut a unified d-party release by dispatching the root release.yml workflow with a patch / minor / major version bump. Always confirms the bump type with the user through explicit options before dispatching (in the scheduled GitHub Actions run it picks the bump by the rules in its non-interactive section instead), then watches the run through the version bump, the arm64 GHCR image builds and the Chrome Web Store upload. Use when asked to release, cut a version, publish, or tag d-party.
---

# Release (d-party)

d-party はモノレポで、リリースは **`release` ワークフロー 1 本**で完結する。
ローカルで tag を打たない。version を手で書き換えない。

ワークフローがやること:

1. ルートの最新タグ `vX.Y.Z` と `bump_type` から次のバージョンを算出する
2. 6 ファイルの version を書き換えて `main` へ 1 コミット、タグを打ち、GitHub Release を作る
   - `backend/pyproject.toml`（+ `backend/uv.lock`）
   - `extension/package.json` · `extension/public/manifest.json`
   - `frontend/package.json` · `packages/ui/package.json`
   - ルートの `package.json`
3. `backend` / `frontend` を **arm64 ネイティブ**でビルドし、
   `ghcr.io/d-party/backend:vX.Y.Z` / `ghcr.io/d-party/frontend:vX.Y.Z` へ push する
   （Raspberry Pi の k3s で argocd-image-updater がこの semver タグを拾う）
4. 拡張機能をビルドして zip を Release に添付し、Chrome Web Store へ upload する

## 1. バンプ種別を必ずユーザーに確認する

**対話セッションでは省略禁止。** 勝手に patch を選ばない。`AskUserQuestion` で選択肢として提示する。
唯一の例外は末尾の「非対話モード」（GitHub Actions の定期実行）で、そこでは決められた規則で選ぶ。

- **patch** — バグ修正・依存更新のみ。ユーザー向けの機能変更なし
- **minor** — 後方互換のある機能追加
- **major** — 破壊的変更。拡張機能とバックエンドの互換が切れる場合を含む

同時に以下も確認する:

- **`publish`**（拡張機能を Chrome Web Store に公開するか。`false` なら
  アップロードのみ）。既定は `false`
- **`release_note`**（任意。空なら GitHub が自動生成する）

判断材料として、前回タグからの差分を見せてから聞くとよい。モノレポなので
1 回の `git log` で全体が見える。ディレクトリ別に見たいときは pathspec で絞る:

```bash
git fetch --tags origin
LATEST=$(git tag --list 'v*.*.*' | sort -V | tail -n1)
echo "latest tag: ${LATEST}"
git log --oneline "${LATEST}..origin/main"

# 何が変わったかをパッケージ別に
for d in backend extension frontend infra nginx; do
  echo "--- $d ---"
  git log --oneline "${LATEST}..origin/main" -- "$d"
done
```

## 2. 事前チェック

- `main` が緑であること、未マージの release blocker が無いこと
- リリースしたい変更が `main` に**すでにマージ済み**であること
  （ワークフローは `main` の最新をタグ付けする）

```bash
gh pr list -R d-party/d-party --state open
gh run list -R d-party/d-party --branch main --limit 10
```

## 3. 起動

ユーザーが選んだ値で `release.yml` を dispatch する:

```bash
gh workflow run release.yml -R d-party/d-party --ref main \
  -f bump_type=<patch|minor|major> \
  -f release_note="<任意>" \
  -f publish=<true|false>
```

起動直後は run が現れるまで数秒かかる。id を取って watch する:

```bash
sleep 8
RUN=$(gh run list -R d-party/d-party --workflow release.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run watch "$RUN" -R d-party/d-party --exit-status
```

`images` ジョブは arm64 ランナーで 2 イメージを焼くので**数分以上かかる**。

## 4. 完了確認

```bash
git fetch --tags origin && git log --oneline origin/main -3
gh release view -R d-party/d-party --json tagName,name,assets

# 6 ファイルの version がタグと揃っていること
TAG=$(git tag --list 'v*.*.*' | sort -V | tail -n1)
git show "${TAG}:backend/pyproject.toml" | grep -m1 '^version'
for f in extension/package.json extension/public/manifest.json frontend/package.json packages/ui/package.json package.json; do
  echo -n "$f: "; git show "${TAG}:$f" | grep -m1 '"version"'
done
```

GHCR にイメージが上がったことも確認する（Raspberry Pi の配信元）:

```bash
gh api "orgs/d-party/packages/container/backend/versions" -q '.[0].metadata.container.tags'
gh api "orgs/d-party/packages/container/frontend/versions" -q '.[0].metadata.container.tags'
```

## 5. 失敗したとき

- **`images` ジョブが `denied: permission_denied` で落ちる**
  → GHCR パッケージの書き込み許可が足りない。`ghcr.io/d-party/backend` と
    `ghcr.io/d-party/frontend` の
    **Package settings → Manage Actions access → Add repository** で
    `d-party/d-party` に **Write** を付ける（1 回だけの手作業）。
- **version ジョブは成功したが images / extension が落ちた**
  → タグと Release はすでに存在する。修正後に同じバージョンで再実行すれば、
    version ジョブは「already at vX.Y.Z」でコミットを飛ばし、タグを force-update
    するだけで済む。バージョンを進め直す必要はない。
- **Chrome Web Store で 400**
  → 同じバージョンを二重に上げている可能性。タグの最大値を確認する。
    レスポンスボディはログに出しているので `itemError[].error_code` を読む。
- **argocd-image-updater が新しいタグを拾わない**
  → GHCR のパッケージが public になっているか、`update-strategy: semver` の
    許容レンジを確認する。詳細は `infra/argocd/README.md`。

## 非対話モード（GitHub Actions の定期実行）

`.github/workflows/maintenance.yml` が週 1 回、Dependabot の処理の後にこの skill を
無人で動かす。ユーザーに質問できないので、§1 の確認を以下の規則に置き換える。
対話セッションではこの節は無視する。

### リリースするかどうか

前回タグ以降の commit のうち、`chore: release vX.Y.Z` と merge commit を除いた
「中身のある commit」を数える。

```bash
git fetch --tags origin
LATEST=$(git tag --list 'v*.*.*' | sort -V | tail -n1)
git log --no-merges --format='%h %s' "${LATEST}..origin/main" | grep -v '^[0-9a-f]* chore: release v'
```

- **0 件** → リリースしない。`$GITHUB_STEP_SUMMARY` に「変更なしのためスキップ」と書いて終わる。

### バンプ種別

上の commit の件名（Conventional Commits）と本文から決める。

| 条件 | 種別 |
| --- | --- |
| `!:`（例 `feat!:`）か本文に `BREAKING CHANGE` がある | **リリースしない**（下記の issue を立てる） |
| `feat` / `feat(...)` がある（同じ期間に `Revert` で打ち消されたものは数えない） | **minor** |
| それ以外（`fix` · `chore(deps)` · `ci` · `docs` · `refactor` など） | **patch** |

major は自動で選ばない。拡張機能とバックエンドの互換が切れうるので、人が判断する。

### そのほかの入力

- `publish` は **`false`**（Chrome Web Store にはアップロードのみ。公開は人が行う）
- `release_note` は**空**（GitHub の自動生成に任せる）

### 事前チェックの読み替え

- Dependabot のマージは GITHUB_TOKEN で行われるので、**main への push で CI が起動しない**。
  「main が緑」は、前回タグ以降にマージされた PR それぞれの head commit の
  チェックがすべて成功していたことで確認する
  （`gh pr list -R d-party/d-party --state merged --search "merged:>=<前回タグの日付>"` →
  `gh pr view <N> --json statusCheckRollup`）。
- main で直近に走った run に失敗があり、その後の run で解消されていなければリリースしない。
- 開いている Dependabot PR は release blocker ではない。

### 止めるとき・失敗したとき

リリースしない判断をした場合（BREAKING / main が赤）と、`release.yml` の run が
失敗した場合は、`$GITHUB_STEP_SUMMARY` に理由を書き、issue を 1 本立てる。
同じタイトルの open な issue があればそこへコメントする（重複させない）。

```bash
gh issue list -R d-party/d-party --state open --search "in:title 週次リリース保留" --json number
gh issue create -R d-party/d-party --title "週次リリース保留: <理由の要約>" --body "<根拠・run の URL>"
```

### 監視

`gh run watch` は Bash の上限（30 分）に収まらないことがあるので、
`gh run view "$RUN" --json status,conclusion` を数分おきに見て `completed` を待つ。
完了したら §4 の確認を行い、結果を `$GITHUB_STEP_SUMMARY` に書く。
