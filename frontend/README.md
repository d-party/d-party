# d-party Frontend

dアニメストアで「同時視聴」を実現する **d-party** のユーザー向けフロントエンドです。
旧 Django テンプレート（ランディング / 使い方 / ルーム遷移ロビー / 404）を **Next.js (App Router)** ベースに
移行したもので、技術スタックと UI コンポーネントは [d-party Chrome 拡張機能](https://github.com/d-party/d-party-Chrome-Extensions)
と共通化しています。

## スタック

- **Next.js 15**（App Router）/ **Turbopack**（`next dev --turbopack` / `next build --turbopack`）
- **React 19** / **TypeScript**（strict）
- **Tailwind CSS v4** + **shadcn/ui**（Radix UI）— テーマトークンは拡張機能の popup と共通
- **orval** でバックエンド REST API を型安全に生成（`openapi/openapi.json` → `src/infrastructure/api/generated/`）
- **pnpm** + **ESLint**（flat config）+ **Prettier**
- **Storybook** で UI コンポーネントを文書化

## Storybook

UI コンポーネントのカタログを Storybook で公開しています（`main` へのマージ時に GitHub Pages へ自動デプロイ）。

- 公開先: <https://d-party.github.io/frontend/>
- ローカル: `pnpm storybook`（http://localhost:6006）

## ページ

| ルート | 内容 | 旧テンプレート |
| --- | --- | --- |
| `/` | ランディングページ（アニメーション付き） | `web/templates/index.html` |
| `/usage` | 使い方ガイド | `web/templates/usage.html` |
| `/stats` | 統計（誰でも閲覧可。公開 stats API を利用） | `web/templates/chart.html` |
| `/qa` | Q&A（よくある質問） | （新規） |
| `/anime-store/lobby/[roomId]` | ルーム遷移（バージョン確認 → リダイレクト） | `web/templates/lobby_redirect.html` |
| （404） | Not Found | `web/templates/404.html` |

UI はダークモード専用のデザインです。

## セットアップ

```bash
pnpm install
pnpm api:generate     # orval で REST クライアント生成（openapi.json から）
pnpm dev              # http://localhost:3000
```

### その他コマンド

```bash
pnpm build            # next build --turbopack（standalone 出力）
pnpm start            # 本番サーバ起動
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint .
pnpm format           # prettier --write .
```

## バックエンド接続先

接続先は `src/infrastructure/env.ts` に集約しています（旧 `js/common/settings.js` 相当）。
既定はローカル開発バックエンド（`localhost` / `http` / `ws`）で、デプロイ先のドメインと
プロトコル（http/https・ws/wss）はビルド時の `NEXT_PUBLIC_*` 環境変数で上書きします。

```bash
# デプロイ例（ドメイン・プロトコルは環境に合わせて差し替える）
NEXT_PUBLIC_BACKEND_HOST="example.com/"
NEXT_PUBLIC_BACKEND_PROTOCOL="https://"
NEXT_PUBLIC_WEBSOCKET_PROTOCOL="wss://"
```

### monorepo の docker-compose 経由（dev / prod）

monorepo（d-party ルート）の Compose では dev / prod で `NEXT_PUBLIC_*` の渡し方が変わります。

- **dev**（`docker compose up`）: frontend は `node` イメージで `pnpm dev`（HMR）として起動し、
  `NEXT_PUBLIC_*` をルートの `.env.dev` から **実行時に**読み込みます（既定 `localhost` / http / ws）。
  ソースがマウントされるためホットリロードが効きます。
- **prod**（`docker-compose.prod.yml`）: `Dockerfile` で standalone ビルドし、`NEXT_PUBLIC_*` を
  `build.args`（ルート `.env.prod` と同値）で **ビルド時に**焼き込みます（`d-party.net` / https / wss）。
  値を変えた場合は再ビルドが必要です。

> 旧 `FRONTEND_BACKEND_HOST` / `FRONTEND_BACKEND_PROTOCOL` 方式は廃止しました。
> 環境固有値はルートの `.env.dev` / `.env.prod` に集約しています。

## ルーム遷移（ロビー）について

ロビーページはバックエンドと拡張機能の双方に依存します。詳細は [AGENTS.md](./AGENTS.md) と
[docs/backend-lobby-endpoint.md](./docs/backend-lobby-endpoint.md) を参照してください。

- 拡張機能の `content-version` スクリプトが `https://d-party.net/anime-store/lobby/*` を match し、
  `.chrome_extension_field` 要素に互換性判定（`true`/`false`）を書き込みます。**この DOM 契約は維持しています。**
- `room_id → dアニメストアのリダイレクト URL` の解決は、新しいバックエンド API
  `GET /api/v1/anime-store/lobby/{room_id}` に委譲します（backend サブモジュール側の追加が必要）。
