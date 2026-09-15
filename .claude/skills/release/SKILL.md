---
name: release
description: Cut a unified d-party release by dispatching the root release.yml workflow with a patch / minor / major version bump. Always confirms the bump type with the user through explicit options before dispatching, then watches the run through submodule releases and the submodule-reference bump. Use when asked to release, cut a version, publish, or tag d-party.
---

# Release (d-party)

d-party のリリースは **ルートリポジトリの `release` ワークフロー 1 本**で完結する
（方式A: 各サブモジュールの release を同じバージョンで起動して待つ）。
サブモジュール側の release を個別に叩かない。ローカルで tag を打たない。

ワークフローがやること:

1. root と各サブモジュールのタグの**最大値**から次バージョンを算出する
2. `backend` / `frontend` / `chrome-extension` の release を同一バージョンで
   `workflow_dispatch` 起動し、完了まで待つ（各サブモジュールが自分の main に
   version commit + タグを打つ。chrome-extension は Chrome Web Store 向けビルドまで）
3. サブモジュール参照を進めて root の main へコミットし、root にも統一タグを打つ
4. root に GitHub Release を作る

## 1. バンプ種別を必ずユーザーに確認する

**これは省略禁止。** 勝手に patch を選ばない。`AskUserQuestion` で選択肢として提示する。

- **patch** — バグ修正・依存更新のみ。ユーザー向けの機能変更なし
- **minor** — 後方互換のある機能追加
- **major** — 破壊的変更。拡張機能とバックエンドの互換が切れる場合を含む

同時に以下も確認する:

- **`publish`**（chrome-extension を Chrome Web Store に公開するか。`false` なら
  アップロードのみ）。既定は `false`
- **`release_note`**（任意。空なら GitHub が自動生成する）

判断材料として、前回タグからの差分を見せてから聞くとよい:

```bash
git fetch --tags origin
LATEST=$(git tag --list 'v*.*.*' | sort -V | tail -n1)
echo "latest root tag: ${LATEST}"
git log --oneline "${LATEST}..origin/main"
for s in backend frontend chrome-extension; do
  echo "--- $s ---"
  git -C "$s" fetch --tags --quiet origin
  git -C "$s" log --oneline "$(git -C "$s" tag --list 'v*.*.*' | sort -V | tail -n1)..origin/main"
done
```

## 2. 事前チェック

- `main` が緑であること、未マージの release blocker が無いこと
- 各サブモジュールの `main` に、リリースしたい変更が**すでにマージ済み**であること
  （ワークフローはサブモジュールの `main` 最新をタグ付けする）
- root の作業ブランチではなく `main` を対象にする

```bash
gh pr list -R d-party/d-party --state open
for r in backend chrome-extension frontend; do gh pr list -R d-party/$r --state open; done
```

## 3. 起動

ユーザーが選んだ値でルートの `release.yml` を dispatch する:

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

`release` ジョブは 3 サブモジュールの release 完了を待つので**数分以上かかる**。
途中経過は各サブモジュール側でも見える:

```bash
for r in backend frontend chrome-extension; do
  echo "=== $r ==="; gh run list -R d-party/$r --workflow release.yml --limit 1
done
```

## 4. 完了確認

```bash
git fetch --tags origin && git log --oneline origin/main -3
gh release view -R d-party/d-party --json tagName,name,createdAt
for r in backend frontend chrome-extension; do gh release view -R d-party/$r --json tagName -q .tagName; done
```

root と 3 サブモジュールのタグが**同じバージョンで揃っている**ことを確認する。

## 5. 失敗したとき

- **サブモジュールの release は成功したが root の bump が失敗した**
  → タグが不揃いのまま残る。ワークフローは次回 root/サブモジュール双方のタグの
    最大値から採番するのでバージョンの巻き戻りは起きないが、root の submodule 参照と
    タグは手当てが要る。`git submodule update --remote` → commit → push → tag。
- **`Triggered run for <repo> did not appear`**
  → GitHub App トークンの Actions:write 権限か、対象リポジトリへの App インストールを疑う。
- **chrome-extension が Chrome Web Store で 400**
  → 同じバージョンを二重に上げている可能性。タグの最大値を確認する。

認証は `APP_ID` / `APP_PRIVATE_KEY` シークレットから発行する GitHub App トークン。
PAT は使わない。
