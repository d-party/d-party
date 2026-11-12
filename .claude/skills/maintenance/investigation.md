# 更新を取り込んでよいか調べる

Dependabot の PR でも、自分で作るセキュリティ更新でも、**マージの前に 1 つずつ**行う。
答えるべき問いは 4 つ。

1. 実際には何が変わるか（PR のタイトルではなく、解決結果）
2. このリポジトリは、それをどこでどう使っているか
3. ライブラリの側で何が変わったか（リリースノートと、差分そのもの）
4. その版は、信頼できる供給元から出た普通の版か

最後に「使っている箇所」と「変わった箇所」を突き合わせ、判定と根拠を残す。

## 深さの決め方

| 対象 | 読む深さ |
| --- | --- |
| 本番で動く直接依存（Django · Channels · daphne · DRF · Next.js · React · 拡張機能に同梱されるもの） | §1〜§7 のすべて。差分は使っている API の実装まで読む |
| ビルド・検査の道具（rspack · turbo · eslint · ruff · mypy · orval · storybook） | §1〜§5。差分は設定の読み方と出力に関わる所を読む。ゲートの結果を重く見る |
| 推移的依存 | §1 · §2（誰が引き込み、本番に届くか）· §3 の配布物の差 · §4 |
| 脆弱性の修正版 | 上に加えて、修正の commit を特定し、それ以外に何が入ったかを見る |

patch 更新でも省かない。破壊的変更は patch にも入るし、乗っ取られた版は patch として出る。

## 1. 何が変わるか

PR が触るのは `package.json` の 1 行でも、ロックファイルでは推移的依存がまとめて動く。

```bash
# PR。base は分岐点にする（origin/main だと、main 側の進みが逆向きの差として混ざる）
.claude/skills/maintenance/scripts/depdiff.sh lock "$(git merge-base origin/main origin/<PR のブランチ>)" origin/<PR のブランチ>
.claude/skills/maintenance/scripts/depdiff.sh lock origin/main      # origin/main から切った作業ツリーと比べる
```

- 出てきた行が調査の対象。タイトルに無いパッケージが動いていたら、それも調べる。
- `(なし) -> x.y.z` は新しく入る依存。§4 を必ず行う。
- 同じ名前に版が 2 つ並んだら（`4.1.0 -> 3.25.0, 4.1.0`）、重複して入っている。
  どちらを誰が使うかを §2 で確かめる。
- major を跨ぐものと、0.x の minor（0.x は minor が破壊的変更）に印を付ける。

## 2. どこでどう使っているか

### 誰が引き込んでいて、本番に届くか

```bash
pnpm why -r <pkg>                                        # npm: どのパッケージのどの依存から来るか
(cd backend && uv tree --invert --package <pkg>)         # Python
(cd backend && uv tree --invert --package <pkg> --no-dev)  # 何も出なければ開発用にしか入らない
```

| 届く先 | 見分け方 |
| --- | --- |
| backend の本番イメージ | `uv tree --no-dev` に出る |
| 拡張機能の配布物 | `extension` の `dependencies` から辿れる（rspack が同梱する） |
| frontend の本番イメージ | `frontend` · `packages/ui` の `dependencies` から辿れる |
| 開発機と CI だけ | `devDependencies` · dev グループからしか辿れない |

開発用でも無関係ではない。ビルドの道具は配布物を作るので、乗っ取られれば配布物が汚れる。

### 使っている箇所を洗い出す

import だけを探さない。設定ファイルや文字列で参照していることがある。

```bash
# npm: import / require / 動的 import
grep -rnE "from ['\"]<pkg>(/[^'\"]*)?['\"]|require\(['\"]<pkg>|import\(['\"]<pkg>" \
  extension/src frontend/src packages/ui/src

# npm: 設定・スクリプト・CSS（--include は名指しのファイルにも効くので、2 つに分ける）
grep -rn "<pkg>" --include=package.json --include='*.config.*' --include='*.css' \
  extension frontend packages | grep -v node_modules
grep -rn "<pkg>" turbo.json pnpm-workspace.yaml extension/.storybook frontend/.storybook

# Python: import（配布名と import 名は違うことがある）
(cd backend && uv run python -c '
import importlib.metadata as m, sys
want = sys.argv[1].lower().replace("_", "-")
print(sorted(k for k, v in m.packages_distributions().items()
             if want in [d.lower().replace("_", "-") for d in v]))' <配布名>)
grep -rnE "^\s*(from|import) <import 名>" backend --include='*.py' | grep -v '/.venv/'

# Python: 文字列での参照（INSTALLED_APPS · MIDDLEWARE · バックエンド指定）、設定、起動コマンド
grep -rn "<import 名>" backend/d_party/settings.py backend/pyproject.toml backend/Dockerfile \
  backend/*.sh docker-compose*.yml infra/helm/d-party
```

洗い出したら、**呼んでいる API を列挙する**（関数 · クラス · 引数 · 設定キー · CLI のフラグ ·
頼っている既定値）。§3 で読む場所がこれで決まる。

- 明示していない引数は、既定値に頼っている。既定値の変更はここに効く。
- 型だけ使っている（`import type`）なら、影響は typecheck で分かる。
- 推移的依存は、引き込んでいる親が何のために使っているかを見る（§3 の親の差分で分かる）。

### 公開インターフェースに触るか

次に関わる依存は、片側だけ変わると壊れる。該当したら両側を確かめる。

- WebSocket プロトコル（`backend/streamer/format.py` ⇔ `extension/src/domain/protocol.ts`）—
  Channels · channels-redis · daphne · シリアライズ周り
- REST API と生成コード（`backend/api/` ⇔ `openapi/openapi.json` ⇔ orval の出力）—
  DRF · drf-spectacular · orval
- ロビーの DOM 契約（`.chrome_extension_field`）— Next.js · React

## 3. ライブラリの側で何が変わったか

### リリースノート

現在の版から目標の版まで、**間の版を全部**読む（取得先は `dependabot-review-and-merge` の §2）。
「Breaking」「Deprecated」「Removed」「Changed」「Security」と、既定値の変更を拾う。
リリースノートは書き漏らす。ここで終わりにしない。

### ソースの差分

```bash
# リポジトリを特定する
npm view <pkg> repository.url
curl -fsS https://pypi.org/pypi/<pkg>/json | jq '.info.project_urls'

# タグの付け方はまちまち（v1.2.3 · 1.2.3 · <pkg>@1.2.3）
gh api "repos/<owner>/<repo>/tags" --paginate -q '.[].name' | grep -F '<版>'

# 変わったファイルと commit
gh api "repos/<owner>/<repo>/compare/<旧タグ>...<新タグ>" \
  -q '"commits: \(.total_commits)", (.files[] | "\(.status)\t+\(.additions) -\(.deletions)\t\(.filename)")'
gh api "repos/<owner>/<repo>/compare/<旧タグ>...<新タグ>" -q '.commits[] | "\(.sha[0:8]) \(.commit.message | split("\n")[0])"'

# 特定のファイルの差分
gh api "repos/<owner>/<repo>/compare/<旧タグ>...<新タグ>" -q '.files[] | select(.filename == "<path>") | .patch'
```

ファイルが 300 を超える比較は一覧が切れる。そのときは commit の一覧から当たりを付けるか、
配布物の差を使う。

### 配布物の差分

実際にインストールされるのはリポジトリではなく、レジストリに公開された配布物。
ビルド済みの出力が入っていて、リポジトリと一致するとは限らない。

```bash
.claude/skills/maintenance/scripts/depdiff.sh npm  <pkg> <旧> <新>
.claude/skills/maintenance/scripts/depdiff.sh pypi <pkg> <旧> <新>

# 続きは展開先を直接比べる（展開したものは実行しない）
git diff --no-index <旧の展開先>/<path> <新の展開先>/<path>
```

### 何を読むか

§2 で列挙した API を起点に読む。

- **使っている関数・クラスの実装**: シグネチャ · 引数の既定値 · 返り値の形 · 投げる例外 ·
  同期か非同期か
- **型定義**（`.d.ts` · `py.typed`）: 圧縮された JS しか無いときは、型の差が API の差を表す
- **入口**: `package.json` の `exports` · `main` · `type`、Python の `__init__.py` の公開名。
  ここが変わると import が解決できなくなる
- **要求**: `engines` · `requires_python` · peer dependency。§5 と突き合わせる
- **依存の増減**: 増えた依存は、それ自体を §4 で調べる
- **設定の読み方**: 設定キーの改名 · 既定値 · 環境変数
- **脆弱性の修正**: アドバイザリが指す修正 commit を見つけ、修正の中身と、
  その版に修正以外の変更が入っているかを確かめる

差分が大きくて読み切れないときは、読めた範囲と読めなかった範囲を記録に書く。
「全部読んだ」ことにしない。

## 4. 供給元

`depdiff.sh` の「公開情報」と「package.json の差」を見る。

| 見る点 | 判断 |
| --- | --- |
| 公開日時 | 1 日以内なら待つ。`minimumReleaseAge` を外さない |
| 公開者 | 前の版と違えば、リポジトリの履歴でメンテナの交代を確かめる。説明が付かなければ止める |
| provenance | 「あり → なし」になったら止める（CI から出ていた版が手元から出された） |
| install スクリプト | 増えた・変わったら中身を読む。実行の可否は `pnpm-workspace.yaml` の `allowBuilds`。勝手に足さない |
| 新しい依存 | 名前（似せた名前でないか）· 公開日 · 公開者 · リポジトリを見る |
| タグとの対応 | 配布物にだけあってリポジトリに無いコードは、ビルド出力として説明が付くか |
| ライセンス | 変わったら許可リスト（`*/license-whitelist-*.txt`）に照らす。ゲートの license でも落ちる |
| 取り下げ | PyPI の `yanked` が true の版 · npm で `deprecated` が付いた版は入れない |

差分の中で、次が**新しく現れたら**理由を確かめる: ネットワークへの接続 · 環境変数や
認証情報の読み取り · ファイルの書き込み · 子プロセスの起動 · `eval` / 動的なコード生成 ·
読めないように詰められた文字列。説明が付かなければ取り込まず、ユーザーに知らせる。

## 5. ランタイムと周辺の下限

更新が要求する下限（`engines` · `requires_python` · 対応する PostgreSQL / Redis の版）を、
実際に動かしている版と突き合わせる。実際の版は `scripts/pins.sh` が一覧にする。
足りなければ、[toolchain.md](toolchain.md) の手順で版を上げるか、見送る。

ecosystem ごとの注意:

- **docker**（ベースイメージ）: OS の世代（bookworm → trixie など）と Python / Node の minor が
  変わっていないか。`gates.sh docker` でビルドし、起動後の疎通は PR の Backend/Build ·
  Frontend/Build で見る。本番は arm64 なので、タグに arm64 のイメージがあることも確かめる
  （`docker buildx imagetools inspect <image>`）。
- **docker-compose**: `Nginx/CI` はイメージを固定で持っていて、compose の nginx を上げても
  追従しない。`gates.sh nginx` が compose の実際のイメージで構文を検査する。postgres の major は
  データディレクトリの移行が要るので、bump だけでは取り込めない（見送って報告する）。
- **github-actions**: action の major は入力名と既定値、要求するランナーの Node を見る。
  使っている入力が新しい `action.yml` に残っていることを確かめる
  （PR の CI で走らないワークフローの扱いは [toolchain.md](toolchain.md)）。

## 6. テストはその経路を通っているか

ゲートが通っても、その依存を通る経路が実行されていなければ何も確かめていない。

- **backend**: `gates.sh` の pytest のログにカバレッジの表がある。§2 で洗い出したファイルが
  実行されているかを見る。テストは Redis を使わず、ASGI サーバも起動しない。
  Channels · channels-redis · daphne · redis · gunicorn · uvicorn を上げたときは、
  スタックを起動して WebSocket を実際に流す:

  ```bash
  docker compose up -d --build
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
    -f docker-compose.loadtest.yml --profile loadtest run --rm k6
  docker compose logs django | grep -iE "error|traceback" | head
  ```

- **frontend**: `gates.sh smoke` が本番と同じ `server.js` を起動し、ページ · DOM 契約 ·
  OG 画像を叩く。
- **拡張機能**: 自動テストが無い。確かめられるのは typecheck · lint · 本番バンドル
  （`gates.sh bundle`）· Storybook のビルドまで。dアニメストア上の動作はこの環境から
  確かめられない。同梱される依存の挙動が変わる更新は、その旨を報告に書き、
  SKILL.md の「リリース」の確認に回す。

## 7. 判定と記録

| 判定 | 意味 | 次 |
| --- | --- | --- |
| 安全 | 変わった箇所を使っていない、または使い方に影響しないと根拠付きで言える | ゲートを通してマージ |
| 移行が要る | 使っている API が変わった | 移行コードを同じ PR に足す（SKILL.md §2） |
| 挙動が変わる | 壊れないが、利用者や運用から見える挙動が変わる | マージしてよいかを判断し、報告に別立てで書く |
| 見送り | 下限が足りない · 供給元に疑問 · 直しようがない | PR にコメントして開いたままにする |

更新ごとに次を残す（PR のコメントか、最後の報告に入れる）:

```
<pkg> <旧> -> <新>（直接 / 推移的 · 本番 / 開発用）
変わるもの   : ロックファイル上の差（一緒に動いた依存を含む）
使用箇所     : ファイルと、使っている API
読んだもの   : リリースノート（版の範囲）· 比較した差分（ファイル名）· 読めなかった範囲
突き合わせ   : 変更点ごとに「該当なし（理由）」か「該当（対処）」
供給元       : 公開日時 · 公開者 · provenance · install スクリプト · ライセンス
検証         : 回したゲートと結果 · テストがその経路を通っているか
判定         : 安全 / 移行が要る / 挙動が変わる / 見送り
```

「該当なし」は、探した語と探した範囲を添えて初めて根拠になる。
