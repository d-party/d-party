# ランタイムと道具の版

Python · Node · pnpm · uv · GitHub Actions · PostgreSQL / Redis / nginx の版を保守する。
Dependabot は 1 か所しか書き換えない（または見ていない）ので、**同じものを指す残りの箇所を
揃える**のと、**Dependabot が見ていない版を拾う**のがここでの仕事。

## 1. 集める

SKILL.md §1 の `pins.sh`（どこに何が書いてあるか。食い違いは ⚠）と `pins.sh latest`
（上流の最新版 · サポート期限 · LTS）の出力を使う。

| 対象 | Dependabot が上げる所 | 手で揃える所 |
| --- | --- | --- |
| Python | `backend/Dockerfile` | `backend/.python-version` · `pyproject.toml`（`requires-python` · ruff `target-version` · mypy `python_version`）· devcontainer |
| Node | `frontend/Dockerfile` · `docker-compose.override.yml` · `@types/node` | ワークフローの `node-version` · devcontainer · `engines.node` |
| pnpm | なし | `packageManager`（ルート · extension · frontend の 3 か所） |
| npm | — | 固定していない。Node のイメージに同梱の版で、corepack を入れるためだけに使う |
| uv | `backend/Dockerfile` | なし（setup-uv と devcontainer は最新を取る） |
| GitHub Actions | `uses:` | `runs-on` · ジョブの `services` のイメージ · `env` に書いたイメージ |
| PostgreSQL · Redis · nginx | `docker-compose.yml` | `infra/helm/d-party/values.yaml` · ワークフローの `services` · `nginx-ci.yml` の `NGINX_IMAGE` |
| k6 | `docker-compose.loadtest.yml` | devcontainer |
| pre-commit のフック | なし | `.pre-commit-config.yaml` の `rev`（`pre-commit autoupdate`） |

`pins.sh` の `floating`（`latest` 指定）· `infra`（`registry:2` · `buildkit:rootless` など、
Dependabot が見ていないイメージ）· Actions の major タグ（`@v7`）は、PR を経ずに中身が変わる。CI が理由なく落ち始めたら、まずここを疑う。

## 2. 何をするか

| 状況 | すること |
| --- | --- |
| ⚠（同じものを指すピンが食い違う） | 揃える PR を出す。わざと分けているなら理由を確かめて報告に書く |
| Dependabot の PR が 1 か所だけ上げた | 残りの箇所を**同じ PR に**足す（SKILL.md §2） |
| 同じ系統の新しい版がある（Python 3.15.x · Node 26.x） | PR は要らない。リリースのビルドで入る（§4） |
| pnpm · pre-commit など、Dependabot が見ていない版が古い | PR を出す（§3） |
| Actions の major が古いのに Dependabot の PR が無い | 閉じられた PR か ignore を探し、理由が無ければ PR を出す |
| 新しい系統がある（Python 3.x → 3.y · Node · pnpm の major など） | §3 の条件を満たせば上げる。満たさなければ報告に条件を書く |
| サポート期限まで 6 か月を切った | 上げる。条件を満たせないなら、止まってユーザーに知らせる |

## 3. 上げる

どの更新も [investigation.md](investigation.md) の調査をする（ランタイムの「使用箇所」は
コード全体なので、リリースノートの削除 · 非推奨 · 既定値の変更を grep で潰す）。

- **1 つの対象につき 1 本の PR。書いてある箇所を全部、同じ PR で上げる。**
  終わったら `pins.sh` に ⚠ が無いこと。
- **系統を上げるのは、1 回の保守で 1 対象まで。** 落ちたときに原因を切り分けられなくなる。
- ブランチは `chore/<対象>-<版>`、ワークフローだけなら commit は `ci(deps):`。

| 対象 | 系統を上げてよい条件 | ゲート |
| --- | --- | --- |
| Python | 正式版（rc でない）。`uv lock` が解決する。Django · Channels が対応を表明している。pytest のログに新しい DeprecationWarning が無い | `backend docker` |
| Node | 偶数の系統で、LTS に入っている（`pins.sh latest` の LTS の日付が過去）。Next.js · rspack の `engines` が許す。`@types/node` も同じ major にする | `web bundle smoke docker` |
| pnpm | major はリリースノートの破壊的変更と `pnpm-workspace.yaml` のキーを確かめる。公開から 1 日経っている。上げた後 `pnpm install --frozen-lockfile` が通り、`depdiff.sh lock origin/main` に差が出ない（出たら解決が変わっている。差を調査する） | `web bundle smoke docker` |
| uv | `(cd backend && uv lock --check)` が通る | `backend docker` |
| GitHub Actions | [investigation.md](investigation.md) §5。使っている入力が新しい `action.yml` に残っている | `repo` と PR の CI |
| Redis · nginx | compose · helm · ワークフローを同じ版にする。設定の非互換をリリースノートで確かめる | `compose nginx infra backend` |
| OS の世代（bookworm · alpine） | Dockerfile の `apt-get` / `apk` のパッケージ名が残っている | `docker` と PR の Build |
| PostgreSQL の major | **上げない。** データの移行が要る。期限と手順の要否を報告する | — |

注意:

- **arm64 はリリースまでビルドされない。** PR の CI と `gates.sh docker` は amd64 だけ。
  ネイティブコードを含む依存（wheel に `cp3xx` が付くもの · `sharp`）が動く更新では、
  新しい版に `aarch64` の配布物があることを確かめる
  （`curl -fsS https://pypi.org/pypi/<pkg>/<版>/json | jq -r '.urls[].filename'`）。
  無ければ本番イメージのビルドが落ちうる。その旨を報告に書く。
- **`release.yml` · `maintenance.yml` · `storybook-deploy.yml` は PR の CI では走らない。**
  これらが使う action を上げたら、差分を読んで確かめるしかない。最初の実行はリリース
  （SKILL.md §6）になる。落ちたら skill `release` の §5。
- devcontainer の変更は、コンテナを作り直すまで効かない。報告でユーザーに伝える。
- 非推奨の警告は実行結果に出る。`gh run view <id> -R d-party/d-party` の ANNOTATIONS を、
  main の直近の run で見る。

## 4. 本番で動いている版

Dockerfile のタグは系統まで（`python:3.15-slim-bookworm` · `node:26-alpine`）なので、
同じ系統の修正はリリースのビルドで入る。逆に言えば、**リリースしない限り入らない**。

```bash
TAG=$(git tag --list 'v*.*.*' | sort -V | tail -n1)
docker run --rm "ghcr.io/d-party/backend:${TAG}" python -V
docker run --rm --entrypoint node "ghcr.io/d-party/frontend:${TAG}" -v
```

`pins.sh latest` の最新と比べ、遅れていて間にセキュリティ修正があれば、
リポジトリに変更が無くてもリリースする理由になる（SKILL.md §6）。

k3s 上の nginx · PostgreSQL · Redis は helm の values のタグを引く。このリポジトリの
リリースでは入れ替わらないので、遅れは報告に書く。
