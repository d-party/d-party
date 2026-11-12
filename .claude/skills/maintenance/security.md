# 保留中のセキュリティ更新

GitHub の Security タブに出ている脆弱性と、出ていないが実際には入っている脆弱性を洗い出し、
修正版があるのに取り込まれていないものを PR にして取り込む。

## 1. 洗い出す

**GitHub のアラートだけを信じない。** このリポジトリでは Dependabot security updates が
無効で、アラートが 0 件でもローカルの監査では脆弱性が出たことがある。必ず両方を見て突き合わせる。

```bash
# GitHub 側
gh api "repos/d-party/d-party/dependabot/alerts?state=open&per_page=100" --paginate \
  -q '.[] | [.number, .security_advisory.severity, .dependency.package.ecosystem, .dependency.package.name,
             .security_vulnerability.vulnerable_version_range,
             (.security_vulnerability.first_patched_version.identifier // "修正版なし"),
             .dependency.scope, .dependency.manifest_path, .security_advisory.ghsa_id] | @tsv'
gh api "repos/d-party/d-party/code-scanning/alerts?state=open&per_page=100" --paginate \
  -q '.[] | [.number, .rule.security_severity_level, .rule.id, .most_recent_instance.location.path] | @tsv'
gh api "repos/d-party/d-party/secret-scanning/alerts?state=open" -q '.[] | [.number, .secret_type_display_name] | @tsv'

# ローカルの監査（ロックファイルを直接調べる）
pnpm audit                 # 全体
pnpm audit --prod          # 本番に入るものだけ
(cd backend && uv audit)
(cd backend && uv audit --no-dev)
```

- API が 403 / 404 を返したら、その機能が無効か権限が無い。「0 件」と区別して報告に書く。
- **食い違い**（GitHub は 0 件なのに監査では出る、またはその逆）は、それ自体を報告する。
  依存グラフがロックファイルを読めていない可能性がある。
- 閉じられたアラートも見る（`state=dismissed`）。誰かが理由を付けて閉じたものは、
  その理由がいまも成り立つかを確かめるだけにして、勝手に開き直さない。

扱いの範囲:

| 種類 | この skill でやること |
| --- | --- |
| 依存の脆弱性（Dependabot アラート · 監査の指摘） | §2 以降で PR にして取り込む |
| code scanning（CodeQL） | 一覧を報告する。自分のコードの修正なので、依存更新とは別の作業として提案する |
| secret scanning | **止めてユーザーに知らせる。** 値を画面・ログ・PR に出さない。鍵の失効は人が行う |

## 2. なぜ保留になっているか

脆弱性ごとに、次のどれかに分類する。分類で対処が決まる。

| 状態 | 見分け方 | 対処 |
| --- | --- | --- |
| Dependabot の PR が開いている | アラートの依存名で PR を探す | SKILL.md §2 で取り込む（ここでは何もしない） |
| 修正版があり、いまの指定範囲に収まる | 親の指定レンジが修正版を含む。ロックファイルが古いだけ | §4 の A |
| 修正版があるが、親の依存が古い版を指している | `pnpm why -r` / `uv tree --invert` で、親のレンジが修正版を含まない | §4 の B → C |
| 修正版があるが、自分で上限を掛けている | `backend/pyproject.toml` の `<` や `package.json` の固定 | §4 の D |
| 修正版が公開から 1 日経っていない | `depdiff.sh` の公開日時 | 待つ。次回に回す |
| 修正版がプレリリースしか無い | 修正版の版名に `rc` · `beta` · `a` · `b` が付く | 取り込まない。§5 |
| 修正版が無い | アドバイザリに patched version が無い | §5 |
| Dependabot が PR を作れなかった | Security タブのアラートに理由が出る（解決できない · PR の上限 · 過去に閉じた / ignore した） | 理由に応じて A〜D |

## 3. 届くかどうかを見積もる

直すかどうかではなく、**急ぎ具合と報告の書き方**を決めるために行う（直せるものは全部直す）。

1. **どこに入るか**: 本番の backend / 拡張機能の配布物 / 本番の frontend / 開発機と CI だけ
   （[investigation.md](investigation.md) の §2）
2. **脆弱な機能を使っているか**: アドバイザリが挙げる関数・設定・入力経路を、
   このリポジトリか親の依存が通るか
3. **外から届くか**: 攻撃者が入力を送れる経路（WebSocket · REST · ロビーの URL）に乗っているか。
   ビルド時にしか動かないなら、入力は自分たちのソースと依存に限られる

「使っていないから安全」と書くときは、探した語と範囲を添える。分からなければ「届きうる」として扱う。

## 4. 直す

上から順に試し、**最も小さい変更**で脆弱な版が消えるものを選ぶ。

```bash
git switch -c fix/<pkg>-<GHSA の末尾か CVE> origin/main
```

### A. ロックファイルの中だけで上げる

指定範囲はそのままで、解決結果だけを修正版へ進める。

```bash
pnpm update <pkg> --recursive --depth 99 --lockfile-only --no-save && pnpm install --frozen-lockfile   # npm
(cd backend && uv lock --upgrade-package <pkg> && uv sync --frozen)                            # Python
```

`--depth` を付けないと、推移的依存は動かない。

`--no-save` を外すと、直接依存では `package.json` の範囲まで書き換わる。
`pnpm audit --fix update` はまとめて上げてしまうので使わない。

### B. 親の依存を上げる

親の新しい版が修正版を要求しているなら、親を上げるのが本筋。親の更新として
[investigation.md](investigation.md) の調査をする。親が major を跨ぐなら C を先に検討する。

### C. 上書きで修正版を強制する（npm の推移的依存）

`pnpm-workspace.yaml` の `overrides` に、既存の行と同じ書き方で足す。

```yaml
overrides:
  "<pkg>@<脆弱なレンジ>": ">=<修正版>"
```

- 左辺は**脆弱なレンジだけ**に絞る。major の違う系統を巻き込まない
  （3.x と 4.x が同居しているなら、系統ごとに行を分ける）。
- 修正版が親の要求する major の中にあること。major を跨いで強制すると、親が壊れる。
  跨ぐしかないなら B に戻るか、§5 へ。
- Python には同じ仕組みを置いていない。A で上がらなければ、直接依存として下限を書く
  （`uv add '<pkg>>=<修正版>'`）のではなく、まず親の制約を調べて B か D を選ぶ。

### D. 自分で掛けた上限を外す

上限には理由がある。`git log -S'<その行>' -- backend/pyproject.toml` で入れた commit を探し、
理由がいまも成り立つかを確かめる。成り立つなら外さず、§5 へ。

### 直したら

```bash
.claude/skills/maintenance/scripts/depdiff.sh lock origin/main     # 狙った依存だけが動いたか
pnpm audit; (cd backend && uv audit)                               # その指摘が消えたか
pnpm why -r <pkg>                                                  # 脆弱な版が残っていないか
```

- 狙っていない依存が動いていたら、原因を調べる。説明が付かなければやり直す。
- 動いた依存すべてに [investigation.md](investigation.md) の調査をする。
  **修正の commit を読み、何をどう直したかを PR に書く。**
- SKILL.md の「ゲートの回し方」の区分で `gates.sh` を回す。

### ついでに確かめる

`overrides` の既存の行のうち、親の更新でもう要らなくなったものは外す
（行を消して `pnpm install` し、`pnpm why -r <pkg>` で脆弱な版が戻らないことを確かめる）。
外すのは別の PR にする。

### PR を出して取り込む

```bash
git status --porcelain      # ゲートが書き換えたファイル（生成コード · tsconfig.json）は git restore で戻す
git add <変えたマニフェストとロックファイル>
git commit -m "fix(deps): <pkg> を <修正版> へ上げる（<GHSA-ID>）"
git push -u origin HEAD
gh pr create -R d-party/d-party --title "fix(deps): <pkg> <旧> -> <新> (<GHSA-ID>)" --body-file <本文>
```

本文（`.github/PULL_REQUEST_TEMPLATE.md` の見出しに沿う）に書くこと:

- 脆弱性（GHSA / CVE · 深刻度 · 影響する版の範囲 · 概要）
- どこに入っていて、届くかどうか（§3）
- なぜ保留になっていたか（§2）と、選んだ直し方（A〜D）
- [investigation.md](investigation.md) の記録
- 監査の結果（直す前と後）

PR の CI が**すべて緑**になってから
`gh pr merge <N> -R d-party/d-party --squash --delete-branch --match-head-commit "$(git rev-parse HEAD)"`。
マージ後に `git fetch` して、次の脆弱性は新しい `origin/main` から始める。

## 5. 直せないもの

修正版が無い · プレリリースしか無い · 上限を外せない · major を跨がないと直らない、のどれか。
**無理に入れない。** 代わりに次を行う。

1. §3 の見積もりを書く（どこに入り、届くか）
2. 緩和策があるか調べる（脆弱な機能を使わない設定 · 親の依存の差し替え · その extra を外す）。
   緩和策がコードや設定の変更になるなら、PR にする前にユーザーに提案する
3. 報告に載せる。**本番に届く high / critical** は、ユーザーに知らせたうえで issue にする
   （同じ件の open な issue があればそこへ追記する）。issue に攻撃手順は書かない
4. 次に見るべき条件を書く（「<pkg> の <版> が正式に出たら A で上がる」など）

残ったアラートは、次回の保守で拾う手掛かりになる（dismiss しない）。
