# AGENTS.md — d-party

このリポジトリで作業する AI エージェント・開発者向けのガイドです。

## What this is

`d-party` は **dアニメストアでの「同時視聴」** を提供するサービスです。
このリポジトリは **monorepo** で、サーバ・拡張機能・フロントエンド・インフラ設定が
すべてここに入っています。

**移行の経緯（重要）:** 以前は backend / chrome-extension / frontend を Git サブモジュールと
して束ねた「疑似 monorepo」でした。各リポジトリの履歴を `git filter-repo` で
サブディレクトリへ書き換えてから統合したため、**`git log` / `git blame` / `git bisect` は
移行前まで辿れます**。旧 `chrome-extension/` は `extension/`、旧 `deploy/` は `infra/` です。

## Architecture

| パス         | 中身                       | スタック                                                                     |
| ------------ | -------------------------- | ---------------------------------------------------------------------------- |
| `backend/`   | Django バックエンド        | Python 3.14 · Django 6 · Channels · DRF · PostgreSQL 16 · Redis 7 · Nginx    |
| `extension/` | ブラウザ拡張機能           | Manifest V3 · TypeScript · React 19 · rspack · Tailwind CSS v4 · shadcn/ui   |
| `frontend/`  | ユーザー向けフロントエンド | Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui             |
| `packages/ui/` | 共有 shadcn/ui プリミティブ | TypeScript · Radix · Tailwind CSS v4                                       |
| `infra/`     | k3s (Raspberry Pi) デプロイ | Helm chart · Argo CD · rootless BuildKit                                     |
| `loadtest/`  | WebSocket 負荷試験         | k6                                                                           |

> `extension/` はブラウザ名を含まない名前にしてある。Manifest V3 は Edge など
> Chromium 系ブラウザでもそのまま読み込めるため。パッケージ名（`package.json` の
> `d-party-chrome-extension`）と Chrome Web Store 上の識別子は従来どおり。

### Request / data flow

```
Chrome 拡張機能 (dアニメストアのページに content script を注入)
        │  WebSocket (wss://d-party.net, 既定)
        ▼
Nginx :80/443 ──▶ Django (daphne/uvicorn, Channels)
        ├─ REST API (DRF)            : /api/*
        ├─ WebSocket (Channels)      : 同時視聴の同期
        └─ 管理画面 (Unfold)         : /admin/*
Django ──▶ PostgreSQL 16（永続化） / Redis 7（Channels レイヤ・キャッシュ）
```

負荷の本質は **ブロードキャスト増幅**。1 ルーム N 人で 1 人の操作が `group_send` で
N-1 接続へ配信される（O(N) ファンアウト）。単発 RPS ではなく、多接続を常時つないだ
状態での捌きを測ること。

> **計測基盤は持っていない。** 以前は compose の `metrics` profile に Prometheus /
> Grafana / cadvisor / node-exporter を、backend に django-prometheus を積んでいたが、
> 実際には使っていなかったので一式削除した。`DATABASE_ENGINE` も素の
> `django.db.backends.postgresql` に戻っている。再導入するなら、まず何を見たいのかを
> 決めてから入れること。

## Orchestration（docker-compose はこのルートにある）

サービスのオーケストレーションと各サービスの設定は **このモノレポのルート**が持つ:

```
d-party/                  ← このリポジトリ（ルート）
  docker-compose.yml      nginx · django · frontend · postgres · redis
  docker-compose.override.yml   dev（既定。frontend は pnpm dev で HMR）
  docker-compose.prod.yml       prod（frontend は standalone・nginx は TLS 終端・certbot）
  docker-compose.loadtest.yml   k6（loadtest profile。通常起動に非干渉）
  .env.global             共有 env（ドメイン・Postgres 認証情報・各 upstream）
  .env.dev / .env.prod    環境固有値（DEBUG・MY_DOMAIN・NEXT_PUBLIC_*）
  nginx/ postgres/ redis/ 各サービス設定（runtime data は gitignore）
  package.json  pnpm-workspace.yaml  pnpm-lock.yaml  turbo.json   pnpm workspace
  LICENSE                 MIT（リポジトリで 1 本。パッケージごとには置かない）
  backend/  extension/  frontend/  packages/ui/  infra/  loadtest/
```

- django は `build.context: ./backend`。
- **frontend のビルドコンテキストは `frontend/` ではなくルート**（`dockerfile: frontend/Dockerfile`）。
  pnpm workspace のロックファイルがルートにあり、`frontend/` 単体では
  `--frozen-lockfile` を満たせないため。dev の frontend コンテナも同じ理由で
  リポジトリ全体をマウントする。
- 環境固有値（`DEBUG` / `MY_DOMAIN` など）は **`.env.global` に置かないこと**。
  backend の `manage.py` が `/env_files/.env.global` を `override=True` で読むため、
  ここに残すと本番起動時に dev の値で上書きされる。

## pnpm workspace と Turborepo

pnpm workspace は 3 パッケージ。**ロックファイルはルートの `pnpm-lock.yaml` 1 本**で、
全員が同じ解決結果を共有する（`overrides` と `onlyBuiltDependencies` も
`pnpm-workspace.yaml` に集約）。backend は Python なので workspace の外。

| パッケージ名 | パス | 役割 |
| --- | --- | --- |
| `d-party-chrome-extension` | `extension/` | 拡張機能 |
| `d-party-frontend` | `frontend/` | 公開サイト |
| `@d-party/ui` | `packages/ui/` | 両者が共有する shadcn/ui プリミティブ |

`@d-party/ui` は **TypeScript のソースのまま**公開している（ビルド成果物を持たない）。
消費側がそれぞれトランスパイルする:

- extension … rspack。pnpm の symlink を解決した実パスが `node_modules` の外に
  なるので、ローダの `exclude: /node_modules/` に引っかからない。
- frontend … `next.config.ts` の `transpilePackages: ["@d-party/ui"]`。
- Tailwind … v4 は CSS のある位置からソースを自動検出するので、別パッケージは
  見つけられない。**3 つの CSS エントリすべてに `@source` を書く**
  （`extension/src/presentation/popup/styles.css` · `extension/src/styles/sidebar.css` ·
  `frontend/src/app/globals.css`）。外すと共有 UI のクラスが 6KB ほど purge される。
- Storybook … 両アプリの `.storybook/main.ts` が `packages/ui` の story も拾う。
  テーマトークンが異なるので、同じプリミティブを popup の明るい配色と
  サイトの暗い配色の両方で確認できる。

**`button` は共有していない。** 両アプリで意図的にスタイルが違う（拡張側は hover の
浮き上がりと押し込みの演出を持つ）ため、それぞれが `src/components/ui/button.tsx` を
自前で持つ。`cn` は `@d-party/ui` から import する。

タスクのオーケストレーションは `turbo.json`。`api:generate` → `lint` / `typecheck` /
`build` / `build-storybook` の依存と出力キャッシュを宣言してあるので、
変わっていないタスクは再実行されない。

```bash
pnpm install                    # ルートで 1 回。両パッケージぶん入る
pnpm run api:generate           # OpenAPI から REST クライアントを生成
pnpm run typecheck              # 両パッケージの tsc --noEmit
pnpm run lint
pnpm run build
pnpm run build-storybook
pnpm run license:check

# 片方だけ
pnpm --filter d-party-frontend run build
turbo run lint --filter=d-party-chrome-extension
# 変更の影響範囲だけ（CI で使える）
turbo run lint typecheck build --filter='...[origin/main]'
```

パッケージ名は `d-party-chrome-extension`（`extension/`）と `d-party-frontend`（`frontend/`）。
ディレクトリ名と一致しないので `--filter` で指すときは注意する。

## デプロイ（k3s / Helm / GitOps）

本番想定は **Raspberry Pi (arm64) で組んだ k3s クラスタ**への Helm デプロイ。CD は
**Argo CD（GitOps）**。設定一式は `infra/` にある。詳細手順は
[`infra/README.md`](infra/README.md)（および [`infra/platform/README.md`](infra/platform/README.md)）を参照。

```
infra/
  helm/d-party/        d-party 単体の Helm chart（このリポジトリの本体）
    templates/         nginx · django · frontend · postgres · redis · migrate(hook)
                       · networkpolicy · priorityclass · ingress(任意)
    values.yaml
  platform/            クラスタ共有の基盤（d-party 専用ではない singleton）
    registry.yaml      クラスタ内ローカルレジストリ（registry:2）+ NodePort
    k3s-registries.yaml  各ノードの /etc/rancher/k3s/registries.yaml
  build/               d-party 固有: rootless BuildKit で arm64 ネイティブビルド → 共有レジストリへ push
  argocd/              Argo CD Application の雛形（実体は運用リポジトリへ）
```

設計の要点（**docker-compose とは前提が異なる**ので注意）:

- **ドメイン解決と TLS は Cloudflare Tunnel（cloudflared）がエッジで終端**する。chart は
  クラスタ内 HTTP のみを扱い、nginx は `ClusterIP`（cloudflared が `nginx` Service を指す）。
  cloudflared 本体・ドメイン割り当て・Argo CD 本体の導入は **別の運用リポジトリ**の管轄。
- **マルチテナント前提**: 同じ端末で d-party 以外のサービスも同居できる。リソースは
  release 名で prefix され namespace 非固定。RPi 想定で `replicaCount` は既定 1。
- **d-party は自前の postgres / redis を chart に同梱し、他サービスとは共有しない**。
  別サービスが DB/Redis を要るなら、そのサービス側で別途立てる。
- **共有クラスタ基盤（`infra/platform/`）は d-party の所有物ではない**。chart はそこを
  「既にある共有レジストリ」として参照するだけ。理想は別 platform リポジトリへ切り出し。
- **隔離・優先度**: postgres/redis は `NetworkPolicy` で同 release 内からのみ到達可能にし、
  `PriorityClass`（stateful > app）でメモリ逼迫時にも DB を優先保護する。
- 機微値（`SECRET_KEY` / `POSTGRES_PASSWORD`）は values に直書きせず `secret.existingSecret`
  （SealedSecrets/SOPS 等）で渡すのが既定方針。`config.MY_DOMAIN` は単一ドメイン前提。
- backend イメージは無改変で使う（gunicorn の workers / graceful などは env で上書き）。
  WebSocket を切らさないため django は `replicas: 1` 固定＋グレースフルなローリング更新。

```bash
# chart の静的検証（クラスタ不要）
helm lint infra/helm/d-party
helm template d-party infra/helm/d-party | less

# 手元で実クラスタ検証（k3d）。詳細は infra/README.md
k3d cluster create d-party --agents 2
helm upgrade --install d-party infra/helm/d-party -n d-party --create-namespace \
  --set config.MY_DOMAIN=d-party.example --set secret.existingSecret=d-party-secret
k3d cluster delete d-party        # 後始末
```

## 負荷試験（loadtest/）

backend の **WebSocket（Channels）同時視聴同期** を主対象とした負荷試験。**k6** で
nginx → django(daphne) → Redis channel layer / PostgreSQL という組み上がったスタックを
本番に近い経路でブラックボックス的に叩く。詳細は [`loadtest/README.md`](loadtest/README.md)。

```
loadtest/
  lib/protocol.js        djcrf エンベロープ（action/request_id）の組み立て・遅延計測の埋め込み
  lib/participant.js     1 WS 接続を Promise 化（connect / waitFor(action)）
  scenarios/ws_party.js  1 VU=1 ルーム。create→join→video/reaction→leave のシナリオ
  scenarios/ws_oneway.js 一方通行モード。host のみ配信・非オーナー操作はブロック（配信者型）
  scenarios/ws_timer.js  タイマー（観覧専用）。host のみ配信し spectate 参加者へ配信増幅
  results/               k6 サマリ出力（gitignore）
docker-compose.loadtest.yml   k6 サービス（compose の loadtest profile。通常起動に非干渉）
```

配置方針:

- 負荷試験は**オーケストレーション層の関心事**（docker-compose / nginx / env が対象）
  なので、`backend/` ではなくルート直下に置く。`infra/` と同じカテゴリ。
- 負荷の本質は **ブロードキャスト増幅**: 1 ルーム N 人で 1 人の操作が `group_send` で N-1 接続へ
  配信される（O(N) ファンアウト）。単発 RPS ではなく多接続常時接続下の捌きを測る。
- `consumers.py` の `_pending_room_deletes` は **プロセス内 dict + asyncio.Task で「単一 daphne
  ワーカー前提」**。マルチワーカー / 水平スケール下でのルーム整合はスケール試験で要確認。

```bash
# スタックを起動してから loadtest profile を run（スモーク: 1 ルーム×3 人、30s）
docker compose up -d
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# パラメータは LOADTEST_* env で上書き（例: 20 ルーム×5 人 = 100 接続、2 分）
LOADTEST_VUS=20 LOADTEST_ROOM_SIZE=5 LOADTEST_DURATION=2m \
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# スクリプトの静的検証（スタック不要・実行しない）
docker run --rm -v "$PWD/loadtest:/loadtest" -w /loadtest \
  grafana/k6:0.55.0 inspect /loadtest/scenarios/ws_party.js
```

## backend/（Django）

```
backend/                  ← このディレクトリ直下が django プロジェクト
  d_party/                プロジェクト設定 (settings.py, asgi.py, urls.py)
  streamer/               同時視聴の WebSocket consumers / cron / models
  api/                    DRF REST API (views, urls)
  web/                    管理者向け統計チャートのテンプレート
  pyproject.toml          uv 依存定義
  uv.lock
  Dockerfile              python:3.14-slim + uv（build context は ./backend）
```

- 依存管理は **uv**（`backend/pyproject.toml`）。インフラ設定は backend には無く、ルートが持つ。
- WebSocket は **Django Channels** + `channels-redis` + `djangochannelsrestframework`、ASGI サーバは daphne/uvicorn。
- テストは **pytest**（`pytest-django`, `pytest-asyncio`, `factory-boy`, `pytest-cov`）。
- Lint / フォーマッタ / import 順序 / SAST / 複雑度はすべて **ruff** に集約する
  （<https://docs.astral.sh/ruff/rules/>）。単体 linter を別プロセスで回さない。
  - `S` が flake8-bandit 相当、`C90`（`max-complexity = 10`）と `PLR09xx` が複雑度。
    そのため bandit / lizard の専用ジョブは持たない。
  - `I` が isort 相当なので、import 順序も `ruff check` で検査される。
  - taint 解析だけは ruff の守備範囲外。`repo-ci.yml` の CodeQL（python）が担当する。
  - 型検査は **mypy**（django-stubs / drf-stubs プラグイン）。
- CI は **`backend-ci.yml`**（`Backend/CI`: ruff · pytest · mypy · license-check）。
  `defaults.run.working-directory` が `backend` なので、各ステップは `backend/` の中で
  走る。`paths` フィルタにより backend/ に触れた変更のときだけ起動する。
  イメージ側は **`backend-build.yml`**（`Backend/Build`）が見る。
  PR には pytest のカバレッジが自動コメントされ、バッジ用データは
  `python-coverage-comment-action-data` ブランチに保存される（外部 SaaS 非依存）。
- pre-commit の設定は**ルートの `.pre-commit-config.yaml`**（`files: ^backend/` で
  backend にだけ効く）。pre-commit はフックと設定をリポジトリのルートで解決するため。

## extension/（ブラウザ拡張機能）

```
extension/
  public/
    manifest.json         Manifest V3（service_worker, content_scripts）
    css/ icon/ images/    content script 用 CSS はバンドラではなく manifest の css 配列で注入
    popup.html
  src/
    domain/               プロトコル・設定・リアクションの型（フレームワーク非依存）
      protocol.ts           WS メッセージ型。backend `streamer/format.py` と1対1で対応
    application/          ユースケース・ポート（RoomSession / ports / ActionGuard）
    infrastructure/       外部 I/O（ws/ · storage/ · notifier/ · api/ · env.ts）
    presentation/         注入対象ごとのエントリ（background / content / popup）
    components/ui/button.tsx  Button のみ自前（他の primitive は @d-party/ui）
  rspack.config.ts        エントリ: background · content-store · content-party · content-version · popup
  orval.config.ts  openapi/  tsconfig.json  eslint.config.mjs
  dist/                   ビルド成果物（chrome://extensions で読み込む対象）
```

- **rspack（swc）でビルドする**。`pnpm build` で `dist/` を生成し、`chrome://extensions` の
  「パッケージ化されていない拡張機能を読み込む」で **`dist/`** を指定する（リポジトリ直下ではない）。
- 接続先は `src/infrastructure/env.ts`。**ビルド時の環境変数 `D_PARTY_ENV`** で切り替わる
  （未指定 = `localhost` / http / ws、`production` = `d-party.net` / https / wss）。
  `rspack.DefinePlugin` がビルド時にリテラルへ置換するため、実行時の設定変更はできない。
- REST クライアントは **orval** で生成（`openapi/openapi.json` → `src/infrastructure/api/generated/`）。
  生成物はコミットされ、CI が差分ゼロを検証する。
- 対象サイト: `https://animestore.docomo.ne.jp/animestore/*` および
  `https://anime.dmkt-sp.jp/animestore/*`、ロビーは `https://d-party.net/anime-store/lobby/*`
  （dev は `http://localhost/anime-store/lobby/*`）。
- CI は **`extension-ci.yml`**（`Extension/CI`: 生成物の drift · typecheck · lint ·
  license-check）と **`extension-build.yml`**（`Extension/Build`: `build:prod` と
  manifest の参照先の実在確認 · zip · storybook）。Storybook の Pages 公開は
  `storybook-deploy.yml` が両パッケージぶんをまとめて 1 回でデプロイする
  （GitHub Pages は 1 リポジトリ 1 サイトなので、`/extension/` と `/frontend/` の
  サブパスに分けている）。

## packages/ui/（共有 shadcn/ui）

```
packages/ui/
  src/
    index.ts              barrel。消費側は `import { Tabs, cn } from "@d-party/ui"`
    accordion input label skeleton switch tabs toast tooltip   （+ 各 story）
    lib/utils.ts          cn
    lib/portalContainer.ts  Shadow DOM 内の Radix portal 先（tooltip が使う）
  package.json  tsconfig.json  eslint.config.mjs
```

- **ビルド成果物を持たない。** TypeScript のソースのまま公開し、消費側がそれぞれ
  トランスパイルする。ここが他の monorepo と違うので、消費側の設定を壊さないこと:
  - extension … rspack。pnpm の symlink を解決した実パスが `node_modules` の外に
    なるので、ローダの `exclude: /node_modules/` に引っかからない（設定変更は不要）。
  - frontend … `next.config.ts` の `transpilePackages: ["@d-party/ui"]`。
  - Tailwind … v4 は CSS のある位置からソースを自動検出するため、別パッケージは
    見つけられない。**3 つの CSS エントリすべてに `@source` を書く**
    （`extension/src/presentation/popup/styles.css` · `extension/src/styles/sidebar.css` ·
    `frontend/src/app/globals.css`）。外すと共有 UI のクラスが 6KB ほど purge される。
  - frontend/Dockerfile … `packages/ui` の manifest とソースをコンテキストへコピーする。
    無いとイメージのビルドが落ちる。
  - Storybook … 両アプリの `.storybook/main.ts` が `packages/ui` の story も拾う。
    テーマトークンが異なるので、同じプリミティブを popup の明るい配色とサイトの
    暗い配色の両方で確認できる。story は特定フレームワークに縛れないので
    `@storybook/react` から型を取り、`storybook/no-renderer-packages` だけ無効化している。
- **`button` はここに無い。** 両アプリで意図的にスタイルが違う（拡張側は hover の
  浮き上がりと押し込みの演出を持つ）ため、それぞれが `src/components/ui/button.tsx` を
  自前で持つ。`cn` は `@d-party/ui` から import する。
- 新しく shadcn コンポーネントを足すときは、**まずここへ置く**。片方でしか使わない
  ものも含めて 1 か所に集める。

## frontend/（Next.js）

```
frontend/
  src/
    app/                 App Router（layout / page / usage / anime-store/lobby/[roomId] / not-found）
    components/ui/button.tsx  Button のみ自前（他の primitive は @d-party/ui）
    infrastructure/       env.ts（接続先）・api/（orval 生成 REST クライアント）
    lib/utils.ts          cn()
  openapi/openapi.json    REST スキーマ（extension と同期 + lobby エンドポイント）
  Dockerfile              Next standalone 配信（build context は**ルート**）
```

- 旧 Django テンプレート（ランディング / 使い方 / ルーム遷移ロビー / 404）を **Next.js（App Router）+ Turbopack**
  に移行したユーザー向け公開ページ。技術スタック・UI コンポーネントは extension と揃えてある。
- ビルドは Turbopack（`pnpm dev` / `pnpm build`）。
- ルーム遷移 `/anime-store/lobby/[roomId]` は拡張機能の `.chrome_extension_field` DOM 契約を維持しつつ、
  `room_id → リダイレクト URL` を backend の `GET /api/v1/anime-store/lobby/{room_id}` で解決する
  （`frontend/docs/backend-lobby-endpoint.md` 参照）。
- 接続先は `src/infrastructure/env.ts`（`NEXT_PUBLIC_*` で上書き、既定 `localhost`）。
- **Dockerfile のビルドコンテキストはルート**。workspace 配下でビルドすると Next の
  `outputFileTracingRoot` がワークスペースのルートになり、standalone の中身が
  `standalone/frontend/server.js` + `standalone/node_modules` という形になる。
  runner のレイアウトと `CMD` もそれに合わせてある。

## 開発フロー（GitHub Flow）

このプロジェクトは **GitHub Flow** を採用する（旧 Git Flow から移行済み。`develop` は廃止）。

1. `main` は常にデプロイ可能な状態を保つ。
2. すべての変更は `main` から短命なブランチを切る（命名は `feature/*` · `fix/*` ·
   `chore/*` · `docs/*` の kebab-case）。
3. ブランチへ commit / push し、`main` に対して **Pull Request** を出してマージする。
   `main` へ直接コミットしない。
4. マージ済みブランチは削除する。
5. **リリースは `main` から tag を切って行う**（長命なリリースブランチは作らない）。
6. CI のトリガ・Dependabot の `target-branch` はすべて `main`（`develop` は参照しない）。

monorepo になったので、**backend と frontend と拡張機能にまたがる変更も 1 本の PR で出す**。
以前のように「サブモジュールごとに PR を出し、マージ順を揃え、最後に参照を bump する」
必要はない。

詳細な貢献手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照。

## monorepo としての約束ごと

1. **どのディレクトリのコードも、このリポジトリで直接変更してコミットする。**
   サブモジュールは無くなったので `git submodule` 系のコマンドは一切使わない。
2. **JS の依存は必ずルートで入れる。** `cd frontend && pnpm install` のような
   パッケージ内での install はしない（workspace 全体が再解決され、ロックファイルが
   意図せず動く）。追加は `pnpm --filter <pkg> add <dep>`。
3. **ロックファイルはルートの `pnpm-lock.yaml` 1 本だけ。** パッケージの下に
   `pnpm-lock.yaml` や `pnpm-workspace.yaml` を作らない。
4. **CI のワークフローはルートの `.github/workflows/` にしか置けない。**
   GitHub は入れ子の `.github/workflows/` を読まない。
5. **README はリポジトリのルートに 1 本だけ。** パッケージごとの README は置かない
   （サービスの紹介と開発環境の立ち上げはルートの `README.md` が持ち、設計とコードの
   約束ごとは各ディレクトリの `AGENTS.md` が持つ）。`LICENSE` も同様にルートの 1 本。
6. バージョンは全パッケージで揃える。`release` ワークフローが
   `backend/pyproject.toml` · `extension/package.json` ·
   `extension/public/manifest.json` · `frontend/package.json` · ルートの
   `package.json` を同じ値へ書き換え、タグを 1 本打つ。手で個別に上げない。

## CI

ワークフローはルートの `.github/workflows/` に集約。`paths` フィルタで、触った
ディレクトリに対応するものだけが回る。

| ワークフロー           | name               | 対象                                                          | paths |
| ---------------------- | ------------------ | ------------------------------------------------------------- | ----- |
| `backend-ci.yml`       | `Backend/CI`       | ruff · pytest · mypy · license-check                          | `backend/**` |
| `backend-build.yml`    | `Backend/Build`    | hadolint · dockerlint · イメージ build → dockle → migrate → 起動 → API 応答 | `backend/**` |
| `frontend-ci.yml`      | `Frontend/CI`      | 生成物の drift · typecheck · lint · license-check              | `frontend/**` `packages/**` + workspace 設定 |
| `frontend-build.yml`   | `Frontend/Build`   | next build（standalone 出力の確認）· storybook · イメージ build → 起動 → ページ疎通 | 同上 |
| `extension-ci.yml`     | `Extension/CI`     | 生成物の drift · typecheck · lint · license-check              | `extension/**` `packages/**` + workspace 設定 |
| `extension-build.yml`  | `Extension/Build`  | build:prod（manifest の参照先が実在するか）· zip · storybook   | 同上 |
| `infra-ci.yml`         | `Infra/CI`         | helm lint · helm template                                     | `infra/**` |
| `nginx-ci.yml`         | `Nginx/CI`         | nginx テンプレートの構文チェック                               | `nginx/**` |
| `repo-ci.yml`          | `Repo/CI`          | actionlint · shellcheck · yamllint · CodeQL · reviewdog       | 全体  |
| `storybook-deploy.yml` | `Storybook/Deploy` | 両 Storybook を GitHub Pages のサブパスへ公開                  | main のみ |
| `release.yml`          | `Release`          | 統一リリース                                                   | 手動  |

**`<Scope>/CI` と `<Scope>/Build` を分ける。** CI は lint と型検査とテスト、Build は
「出荷するものが実際に組み上がって動くか」。lint が通ってもイメージが起動しない、
バンドルが空、という壊れ方は CI だけでは拾えない。

`Repo/CI` は横断の lint に加えて CodeQL と reviewdog も持つ。reviewdog のジョブは
PR の差分へコメントするのが目的なので `if: github.event_name == 'pull_request'` で
PR のときしか動かさない。

ワークフローの `name` は `<Scope>/<Kind>` で揃えている。PR のチェック一覧で
どの領域のものか一目で分かるようにするため。

ルートから走るツールの設定ファイルもルートに置く（`.yamllint` · `.textlintrc.json` ·
`.dockleignore` · `.pre-commit-config.yaml`）。これらは元々 backend リポジトリの直下に
あり、そのリポジトリのルート = カレントディレクトリだったので効いていた。

### キャッシュ

依存のキャッシュはすべて**ロックファイルのハッシュ**をキーにしている。

| 対象 | 仕組み | キー |
| --- | --- | --- |
| pnpm ストア | `actions/setup-node` の `cache: pnpm` | `pnpm-lock.yaml` |
| uv（Python） | `astral-sh/setup-uv` の `enable-cache` + `cache-dependency-glob` | `backend/uv.lock` |
| Turborepo（`.turbo`） | `actions/cache` | `turbo-<os>-${{ hashFiles('pnpm-lock.yaml') }}-<sha>`（restore-keys で前回分へフォールバック） |
| Next.js（`frontend/.next/cache`） | `actions/cache` | `next-<os>-${{ hashFiles('pnpm-lock.yaml') }}-<sha>` |

ロックファイルが変われば依存の解決結果が変わり、turbo のタスクハッシュも総入れ替えに
なるので、キャッシュもそこで切る。同じロックファイルのあいだは `restore-keys` で
直前の実行結果を引き継ぐため、変更のないタスクは丸ごとスキップされる。

## リリース

`release` ワークフロー（`workflow_dispatch`）1 本で完結する。

1. ルートの最新タグ `vX.Y.Z` と `bump_type` から次のバージョンを決める。
2. 5 ファイルの version を書き換えて main へ 1 コミット、タグを打ち、GitHub Release を作る。
3. backend / frontend を **arm64 ネイティブ**でビルドし、`ghcr.io/d-party/backend:vX.Y.Z` /
   `ghcr.io/d-party/frontend:vX.Y.Z` へ push する。Raspberry Pi の k3s では
   argocd-image-updater がこの semver タグを拾い、Argo CD がローリング更新する。
4. 拡張機能をビルドして zip を Release に添付し、Chrome Web Store へ upload する
   （`publish` 入力が true のときだけ公開まで行う）。

モノレポ化前は root が各サブモジュールの `release` を workflow_dispatch で起動して
待つ方式で、そのために GitHub App（`APP_ID` / `APP_PRIVATE_KEY`）へ他リポジトリの
Actions:write を持たせていた。**それは不要になった。**

代わりに **GHCR の 2 パッケージへ `d-party/d-party` の Write を 1 度だけ付ける**必要が
ある（Package settings → Manage Actions access → Add repository）。もとは
`d-party/backend` · `d-party/frontend` リポジトリからしか push できないため。
イメージ名を変えないことで `infra/helm` の values と Argo CD 側は無改修で済む。

## Common commands

### スタック全体（このルートで実行）

```bash
# 初回起動（migrate + collectstatic）
docker compose build --no-cache
docker compose up -d
# migration ファイルはコミット済みなので migrate のみでよい
# （モデル変更時だけ backend/ で makemigrations して生成物をコミットする）
docker compose exec django python manage.py migrate
docker compose exec django python manage.py collectstatic

# 2 回目以降
docker compose up -d
docker compose ps
docker compose logs -f django
# 監視系も起動する場合
docker compose --profile metrics up -d
```

### backend（`cd backend`, uv）

```bash
cd backend
uv sync
uv run pytest                 # conftest が InMemoryChannelLayer を使うため Redis 不要（DB は要 PostgreSQL）
uv run mypy .
uv run ruff format --check . && uv run ruff check .   # CI と同じゲート
uv run pip-licenses
```

### extension / frontend（ルートで実行）

```bash
pnpm install                  # ルートで 1 回。両パッケージぶん入る

# 拡張機能
pnpm --filter d-party-chrome-extension run build        # dev ビルド（localhost 向け）→ extension/dist/
pnpm --filter d-party-chrome-extension run build:prod   # 本番ビルド（d-party.net 向け）
pnpm --filter d-party-chrome-extension run dev          # rspack --watch
# chrome://extensions →「パッケージ化されていない拡張機能を読み込む」→ extension/dist/ を指定

# フロントエンド
pnpm --filter d-party-frontend run dev
pnpm --filter d-party-frontend run build

# 両方まとめて（CI と同じゲート）
pnpm run api:generate && pnpm run typecheck && pnpm run lint && pnpm run build
```

### インフラ（Helm）

```bash
helm lint infra/helm/d-party
helm template d-party infra/helm/d-party | less
```

## ローカルで CI を再現する

Dev Container には CI が使う lint がひととおり入っている（feature で導入）。

```bash
actionlint                                   # Repo/CI
shellcheck $(git ls-files '*.sh')            # Repo/CI
yamllint .                                   # Repo/CI（設定はルートの .yamllint）
helm lint infra/helm/d-party                 # Infra/CI
pre-commit run --all-files                   # backend の ruff と基本的な整形

cd backend && uv run ruff check . && uv run mypy . && uv run pytest   # Backend/CI
pnpm run typecheck && pnpm run lint && pnpm run build                 # Frontend/CI · Extension/CI
```

> **ruff はグローバルに入れない。** `backend/uv.lock` にピン留めされたものを
> `uv run ruff` で使う。`uvx ruff` や devcontainer feature で入れると常に最新が
> 取れてしまい、整形結果が CI とズレる。

ワークフローそのものを回したい場合は `act`（Dev Container 同梱）。ワークフローは
ルートに集約されているので、リポジトリのルートで実行する。

```bash
act push -W .github/workflows/backend-ci.yml
act pull_request -W .github/workflows/frontend-ci.yml
```

## 動作確認 URL（ローカル backend 起動時）

| URL                            | 内容                       |
| ------------------------------ | -------------------------- |
| `http://localhost`             | アプリ（Nginx 経由）       |
| `http://localhost:8000`        | Django 直接（DEBUG 有効時）|
| `http://localhost:8000/admin/` | 管理画面（Unfold）         |

> PostgreSQL の閲覧は Adminer を廃止し、**VSCode SQLTools 拡張**へ移行（Dev Container 同梱・
> `d-party (compose postgres)` 接続を事前定義。追加設定なしで `localhost:5432` に接続）。

> Redis の閲覧は **Redis for VS Code 拡張**（Dev Container 同梱）。接続の事前定義に対応しない拡張なので、
> 初回だけ「+ Connect database」で `127.0.0.1:6379`（既定値のまま）を登録する。以降は保存される。

> 外部サービス（Google 等）は bot 検出でブロックされることがある。外部調査には
> `WebSearch` / `WebFetch` を優先し、ブラウザ検証は localhost に集中させること。
