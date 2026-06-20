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

## ページ

| ルート | 内容 | 旧テンプレート |
| --- | --- | --- |
| `/` | ランディングページ | `web/templates/index.html` |
| `/usage` | 使い方ガイド | `web/templates/usage.html` |
| `/anime-store/lobby/[roomId]` | ルーム遷移（バージョン確認 → リダイレクト） | `web/templates/lobby_redirect.html` |
| （404） | Not Found | `web/templates/404.html` |

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
既定はローカル開発バックエンド（`localhost`）で、ビルド時に `NEXT_PUBLIC_*` 環境変数で上書きできます。

```bash
# 本番例
NEXT_PUBLIC_BACKEND_HOST="d-party.net/"
NEXT_PUBLIC_BACKEND_PROTOCOL="https://"
NEXT_PUBLIC_WEBSOCKET_PROTOCOL="wss://"
```

## ルーム遷移（ロビー）について

ロビーページはバックエンドと拡張機能の双方に依存します。詳細は [AGENTS.md](./AGENTS.md) と
[docs/backend-lobby-endpoint.md](./docs/backend-lobby-endpoint.md) を参照してください。

- 拡張機能の `content-version` スクリプトが `https://d-party.net/anime-store/lobby/*` を match し、
  `.chrome_extension_field` 要素に互換性判定（`true`/`false`）を書き込みます。**この DOM 契約は維持しています。**
- `room_id → dアニメストアのリダイレクト URL` の解決は、新しいバックエンド API
  `GET /api/v1/anime-store/lobby/{room_id}` に委譲します（backend サブモジュール側の追加が必要）。
