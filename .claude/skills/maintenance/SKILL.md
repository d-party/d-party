---
name: maintenance
description: Run d-party's interactive maintenance cycle - merge the open Dependabot PRs (adding migration code where needed), create and merge pending security updates, keep runtime and tool versions current (Python, Node, pnpm, uv, GitHub Actions), then cut a patch release with the Chrome extension auto-published. Use when asked to do maintenance, take in security updates, or do upkeep and release.
---

# Maintenance (d-party)

依存更新 · セキュリティ修正 · ランタイムと道具の版を取り込み、リリースまで通す。順番は固定。

| § | 段階 | 手順の在りか（その段階に入ってから読む） |
| --- | --- | --- |
| 0 | 準備と control | — |
| 1 | 棚卸し | — |
| 2 | Dependabot PR | skill `dependabot-review-and-merge` · [investigation.md](investigation.md) |
| 3 | 保留中のセキュリティ更新 | [security.md](security.md) |
| 4 | ランタイムと道具の版 | [toolchain.md](toolchain.md) |
| 5 | リリース前の最終確認 | — |
| 6 | リリース | skill `release` |
| 7 | 報告と後片付け | — |

スクリプト（`.claude/skills/maintenance/scripts/`。以下 `scripts/`）:

| スクリプト | 用途 |
| --- | --- |
| `gates.sh [区分...]` | CI と同じ検査を回し、表を出す。区分は `backend web bundle smoke compose nginx infra repo docker` |
| `depdiff.sh lock\|npm\|pypi` | ロックファイルの解決結果の差 · 公開された配布物同士の差 |
| `pins.sh [latest]` | ランタイムと道具の版がどこに書いてあるか · 上流の最新とサポート期限 |

## 約束

- **CI が緑でも、取り込む根拠にはならない。** 更新ごとに [investigation.md](investigation.md) の
  調査をし、根拠を残してからマージする。
- **main を壊れた状態にしない。** 移行コードは bump と同じ PR に載せる。
- **リリースは本番デプロイであり、拡張機能の公開でもある。** イメージが push されると 2 分以内に
  本番へ反映され、拡張機能は Chrome Web Store で公開される。§5 を通さずにリリースしない。

やらないこと（必要に見えたら、理由を示してユーザーに聞く）:

- `minimumReleaseAge` を外す · 除外を足す。プレリリース版を入れる
- 脆弱性アラートを dismiss する。Dependabot の PR を閉じる
- ライセンスの許可リストを広げる。`allowBuilds` に足す
- version を手で書き換える。タグを手で打つ。main へ直接 push する

止まってユーザーに聞くとき:

- §0 の control が赤い
- ゲートが落ち、どの更新が原因か切り分けられない
- 本番に届く high / critical の脆弱性に修正版が無い
- 供給元に不審な点がある（公開者の交代 · provenance の消失 · install スクリプトの追加）
- secret scanning のアラートがある（値を画面 · ログ · PR に出さない）
- `release.yml` が途中で落ちた

## 出力を絞る

長い出力を会話に流さない。安全のための手順は省かず、**読む量**を減らす。

- `gates.sh` は表だけを読む。落ちた検査は末尾が自動で出る。足りなければログを `grep` する。
- PR の本文 · リリースノート · 差分は、`<W>`（§0）のファイルへ落としてから
  `grep` か行の範囲で読む（`gh pr view <N> --json body -q .body > <file>`）。
- `gh` は `--json <列>` と `-q` で要る列だけを取る。
- 差分は一覧（`--stat`）を先に見て、使用箇所に関わるファイルだけを開く。
- CI の待ちは出力を捨てて結果だけ取る:
  `gh pr checks <N> -R d-party/d-party --watch >/dev/null 2>&1; gh pr checks <N> -R d-party/d-party`
- 同じパッケージが複数の PR に出たら、調査は 1 回にして記録を使い回す。
- 差分の大きい更新（フレームワーク本体 · ランタイムの系統）の調査は、サブエージェントに
  [investigation.md](investigation.md) を渡して任せ、その「判定と記録」の記録だけを受け取ってよい。
  記録に「探した語と範囲」が無い項目は根拠として扱わず、自分で確かめる。

## 0. 準備と control

対話セッションで実行する。`gh` に `repo` と `workflow` のスコープが要る（`gh auth status`）。
作業用ディレクトリ（以下 `<W>`）を scratchpad の下に 1 つ作る。シェル変数は Bash の呼び出しを
またいで残らないので、後で使う値は `<W>` のファイルに置く。

```bash
git status --porcelain            # 追跡中のファイルに未コミットの変更があれば、止めて聞く
git branch --show-current > <W>/orig      # 空（detached）なら git rev-parse HEAD を入れる
git fetch --prune --tags origin
git switch --detach origin/main
git rev-parse HEAD > <W>/start-sha && date -u +%Y-%m-%dT%H:%M:%SZ > <W>/started
GATES_LOG_DIR=<W>/control .claude/skills/maintenance/scripts/gates.sh   # 全区分。約 15 分
```

全区分は Bash の上限（10 分）を超える。`run_in_background` で起動し、完了の通知を待つ。
この結果が control（落ちた検査が更新のせいか、元からかを切り分ける基準）。

- FAIL があれば取り込みを始めない。直す PR を先に出すか、ユーザーに聞く。
- PR のブランチは、`origin/main` へ merge か rebase した状態で検証する
  （確かめたいのは main に入った後の状態で、スクリプトも main にある）。

## 1. 棚卸し

```bash
gh pr list -R d-party/d-party --author "app/dependabot" --state open \
  --json number,title,headRefName,mergeStateStatus \
  -q '.[] | [.number, .mergeStateStatus, .title] | @tsv'

LATEST=$(git tag --list 'v*.*.*' | sort -V | tail -n1)
git log --no-merges --format='%h %s' "${LATEST}..origin/main" | grep -v ' chore: release v'

.claude/skills/maintenance/scripts/pins.sh
.claude/skills/maintenance/scripts/pins.sh latest
```

脆弱性は [security.md](security.md) の「洗い出す」で集める。

1 枚の表にまとめてユーザーに見せ、そのまま進む（承認は待たない）: 扱う PR ·
脆弱性ごとの対処（既存の PR で直る / PR を作る / 直せない）· 上げる版 ·
未リリースの commit に `feat` や破壊的変更があるか。

## ゲートの回し方

| 場面 | 区分 |
| --- | --- |
| control（§0）· 束ねた最終状態（§2）· リリース前（§5） | 全区分 |
| uv の更新 | `backend`（イメージに入るものなら `docker` も） |
| npm の更新 | `web bundle smoke`（frontend のイメージに入るものなら `docker` も） |
| Dockerfile | `docker` |
| compose のイメージ | `compose nginx backend` |
| ワークフロー | `repo` |
| helm | `infra` |

- 個々の PR は、上の区分と **PR の CI がすべて緑**であることで判断する。hadolint · dockle ·
  イメージの起動確認 · CodeQL · 拡張機能の zip は PR の CI にしか無い。
- `SKIP` は通ったことにならない（道具が無くて回せなかった検査）。CI の結果で補う。
- `smoke` は `web` と同じ実行で回す（その場のビルドを叩くため）。

## 2. Dependabot PR

Skill ツールで `dependabot-review-and-merge` を呼び、その手順でマージする。次を足す。

- 調査は [investigation.md](investigation.md) の全項目。リリースノートだけで済ませない。
- **マージは調査した commit に縛る。** 調査のときに head を控え、マージで照合する。

  ```bash
  gh pr view <N> -R d-party/d-party --json headRefOid -q .headRefOid > <W>/pr-<N>.sha
  gh pr merge <N> -R d-party/d-party --squash --delete-branch --match-head-commit "$(cat <W>/pr-<N>.sha)"
  ```

  rebase · recreate · push で head が変わったら、`depdiff.sh lock` をやり直して調査した内容と
  同じであることを確かめ（版が変わっていたら調査し直す）、控えを更新する。
- 検証は `gates.sh`。全 PR を束ねた最終状態を作り、**マージの前に**全区分を通す
  （`GATES_LOG_DIR=<W>/final`。通ったら `git rev-parse 'HEAD^{tree}' > <W>/final/tree`）。
- 順番: 脆弱性を直す PR → github-actions → docker / docker-compose → uv → npm。
  npm はロックファイルの衝突が連鎖するので 1 本ずつ。major は最後。
- ランタイムや道具の版を上げる PR は、[toolchain.md](toolchain.md) の表で残りの箇所を揃える。

### そのままでは取り込めない PR

閉じずに、必要な変更を**同じ PR に**足す（Dependabot のブランチへ push する。手順は
`dependabot-review-and-merge` の §6）。push 後の commit で PR の CI が緑になってからマージする。

| 状況 | 対処 |
| --- | --- |
| ロックファイルが衝突している | `@dependabot rebase`。動かなければ `@dependabot recreate`。自分で push した PR には使わず（足した commit が消える）、同 §6 の手順で rebase する |
| 破壊的変更で CI が赤い | 移行コードを足す。bump の commit と分ける |
| グループ PR のうち 1 つだけが取り込めない | その依存だけ元の版へ戻す commit を足し、残りを取り込む |
| 相方の依存も上げないと peer dependency が合わない | 同じ PR で一緒に上げる（相方も調査する） |
| 生成物が drift する（orval など） | `pnpm run api:generate` の結果を同じ PR に入れる |
| ランタイムの下限が上がる | [toolchain.md](toolchain.md) の手順で版を揃える。本番の版が足りなければ見送る |
| ライセンスのゲートが落ちる · 上流のバグで直しようがない | 見送る。調べた内容を PR にコメントし、開いたままにする |

## 3. 保留中のセキュリティ更新

[security.md](security.md) の手順。§2 のマージが終わってから始める
（Dependabot PR で直ったものを二重に直さない）。
**1 パッケージにつき 1 本の PR、1 本ずつ直列**（束ねると、落ちたときに原因が分からない）。

## 4. ランタイムと道具の版

[toolchain.md](toolchain.md) の手順。§1 の `pins.sh` で見つけた食い違いと遅れを片付ける。

## 5. リリース前の最終確認

```bash
git fetch origin && git switch --detach origin/main
GATES_LOG_DIR=<W>/final .claude/skills/maintenance/scripts/gates.sh
```

`git rev-parse 'origin/main^{tree}'` が `<W>/final/tree`（§2 で束ねた最終状態）と同じなら、
回し直さずにその結果を使ってよい。確かめた commit を控える:
`git rev-parse origin/main > <W>/verified-sha`

リリースしてよい条件（すべて）:

1. 全区分が PASS。`SKIP` の検査は CI の結果で補えている
2. §0 以降に main で走った run がすべて完了し、ワークフローごとの最新が成功している

   ```bash
   gh run list -R d-party/d-party --branch main --event push --created ">=$(cat <W>/started)" --limit 100 \
     --json workflowName,status,conclusion,headSha \
     -q '.[] | [.workflowName, .status, .conclusion, .headSha[0:8]] | @tsv'
   ```

   Repo/CI 以外は path で絞られ、main では走らないことがある。その分は、マージした PR の CI
   （Backend/Build · Frontend/Build · Extension/Build を含む）が緑だったことで補う。

3. [security.md](security.md) の「洗い出す」をやり直し、残った脆弱性がすべて理由付きで説明できる
4. `pins.sh` に説明できない ⚠ が無い
5. 拡張機能の配布物の差が説明できる

   ```bash
   diff <W>/control/bundle.sha256 <W>/final/bundle.sha256
   ```

   差が無ければ、利用者に届く中身は変わっていない。差があれば、今回取り込んだどの更新に
   よるものかを言えること。言えない差があれば止まる。

## 6. リリース

リリースするのは、前回タグから中身のある commit があるとき。無くても、本番イメージの
ランタイムにセキュリティ修正が未適用（[toolchain.md](toolchain.md) の「本番で動いている版」）なら
リリースする。どちらでもなければしない。

| 入力 | 値 |
| --- | --- |
| `bump_type` | **`patch`** |
| `publish` | **`true`**（拡張機能を Chrome Web Store で公開する） |
| `release_note` | 空（GitHub の自動生成） |

聞かずに決めてよい。次に当たるときだけ、`AskUserQuestion` で選択肢を出して聞く。

| 条件 | 聞くこと |
| --- | --- |
| 未リリースの commit に `feat` がある | patch のままか、minor にするか |
| `!:` か `BREAKING CHANGE` がある | リリースするか。するなら種別 |
| 拡張機能に、ここでは動作を確かめられない変更が入る（下のどれか） | そのまま公開するか、アップロードだけにして手で確かめるか |

3 行目に当たるもの（拡張機能には自動テストが無く、dアニメストア上の動作は確かめられない）:

- 拡張機能に同梱される依存の major 更新、または [investigation.md](investigation.md) で
  「挙動が変わる」と判定した更新
- rspack の major 更新
- 拡張機能への移行コード
- 今回の保守より前にマージされた拡張機能の変更（次が空でない）:
  `git log --oneline "<前回タグ>..$(cat <W>/start-sha)" -- extension/src extension/public packages/ui/src`

**起動の直前に確かめる。** `release.yml` は起動した時点の main をタグ付けする。週次の
`maintenance.yml` も main へマージし、リリースを起動する。

```bash
git fetch origin && [ "$(git rev-parse origin/main)" = "$(cat <W>/verified-sha)" ] && echo same
for w in maintenance.yml release.yml; do    # 0 が 2 行出ること
  gh run list -R d-party/d-party --workflow "$w" --limit 5 --json status -q '[.[] | select(.status != "completed")] | length'
done
```

main が動いていたら §5 からやり直す。どちらかが実行中なら、終わるのを待って §5 からやり直す。

通ったら Skill ツールで `release` を呼び、§2 以降（事前チェック · 起動 · 完了確認）を行う。
run の id は `<W>/release-run` に置き、`gh run watch` ではなく
`gh run view <id> -R d-party/d-party --json status,conclusion` を数分おきに見る（Bash の上限を超えるため）。
完了確認に足すこと:

- タグの親が確かめた commit である（`git rev-parse '<タグ>^'` が `<W>/verified-sha` と同じ）
- イメージに amd64 と arm64 がある
  （`docker buildx imagetools inspect ghcr.io/d-party/backend:<タグ>`。frontend も。
  `release` §4 の `gh api orgs/...` は `read:packages` スコープが無いと 403 になる）
- `extension` ジョブで Chrome Web Store への upload と publish が成功している
- 数分後に本番が応答する。応答しなければすぐユーザーに知らせる。新しい版に入れ替わったこと
  まではここから確かめられないので、報告にそう書く

  ```bash
  for p in / /api/v1/health; do curl -s -o /dev/null -m 20 -w "$p %{http_code}\n" "https://d-party.net$p"; done
  ```

## 7. 報告と後片付け

報告（更新ごとの記録は [investigation.md](investigation.md) の「判定と記録」の形）:

- 取り込んだもの · 手を入れた PR（足した変更と理由）· 見送ったもの（次に何が起きれば取り込めるか）
- 脆弱性: 直したもの / 残ったもの（深刻度 · 本番に届くか · 直せない理由）/
  GitHub のアラートと監査の食い違い
- 版: 上げたもの · 揃えたもの · 期限が近いもの
- 挙動が変わるが壊れてはいない点（要フォローアップ）
- リリース: 版 · run の URL · イメージ · 拡張機能の公開状況
- ゲート: control と最終の表。`SKIP` だった検査

後片付け:

```bash
git switch "$(cat <W>/orig)"      # commit を控えていたなら --detach
git branch -D <検証用に作ったブランチ>
(cd backend && uv sync --frozen) && pnpm install --frozen-lockfile   # 依存を元のブランチの状態へ
git status --porcelain            # next build が tsconfig.json を書き換えていたら git restore
```

`gates.sh` が postgres を起動していたら（表に `backend: start postgres` がある）、
`docker compose stop postgres` で止める。スタックを起動していたら `docker compose stop`。
`<W>` と `/tmp/depdiff-*` を消す。

## 無人実行

この skill は対話セッション用。`.github/workflows/maintenance.yml` の週次実行は
`dependabot-review-and-merge` と `release` を直接呼び、それぞれの「非対話モード」で動く
（`publish` は `false`）。patch 固定と自動公開は無人実行には適用しない。
