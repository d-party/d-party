# AGENTS.md — d-party Frontend

AI エージェント・開発者向けガイド。dアニメストアで「同時視聴」を実現する d-party の
**ユーザー向けフロントエンド**（旧 Django テンプレートの React 移行版）。

## スタック

- **Next.js 15**（App Router）/ **Turbopack** でビルド（`next dev/build --turbopack`）
- **React 19** / **TypeScript**（strict）
- **Tailwind CSS v4** + **shadcn/ui**（Radix）— テーマトークンは Chrome 拡張機能 popup と共通
- **orval** でバックエンド REST API を型安全に生成（`openapi/openapi.json` → `src/infrastructure/api/generated/`）
- **pnpm** + **ESLint**（flat config, typescript-eslint + @next/next）+ **Prettier**
- 本番は `output: "standalone"`（`Dockerfile`）で Node ランタイム配信

## 構成

```
src/
  app/                     App Router
    layout.tsx               <html>/metadata/Header/Footer
    page.tsx                 ランディング（旧 index.html）— Hero/Features 等を合成
    usage/page.tsx           使い方（旧 usage.html）
    qa/page.tsx              Q&A（新規）— Faq アコーディオン
    anime-store/lobby/[roomId]/page.tsx
                             ルーム遷移（旧 lobby_redirect.html）— client component
    not-found.tsx            404（旧 404.html）
    globals.css              Tailwind + shadcn テーマトークン（拡張機能 popup から移植、ダークは .dark クラス）
  components/
    layout/Header.tsx Footer.tsx
    landing/                 Hero / Features（framer-motion アニメーション）
    motion/Reveal.tsx        スクロール表示アニメ（prefers-reduced-motion 対応）
    theme/ThemeToggle.tsx    class ベースのダークモード切替（初期化は layout.tsx の no-FOUC スクリプト）
    qa/Faq.tsx               アコーディオン（client）
    ui/                      shadcn コンポーネント（拡張機能と共通の Button 等）
  infrastructure/
    env.ts                   接続先設定（NEXT_PUBLIC_* で上書き可、旧 settings.js 相当）
    api/fetcher.ts           orval mutator（customFetch）
    api/generated/           orval 生成クライアント（コミット対象外でなく生成物を含む）
  lib/utils.ts               cn()
openapi/openapi.json         REST スキーマ（拡張機能と同期 + lobby エンドポイント追加）
```

## コマンド

```bash
pnpm install
pnpm api:generate     # orval でRESTクライアント再生成（openapi.json から）
pnpm dev              # next dev --turbopack (:3000)
pnpm build            # next build --turbopack（standalone）
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint .
```

## ルーム遷移（ロビー）の契約 — 変更厳禁

ロビーページ `/anime-store/lobby/[roomId]` は **拡張機能 + バックエンド** の双方と結合する。

1. **拡張機能 DOM 契約**: 拡張機能の `content-version` スクリプトが `https://d-party.net/anime-store/lobby/*`
   を match し、`.chrome_extension_field` 要素の `innerText` に互換性判定（`"true"`/`"false"`）を書き込む。
   ページはこの要素を必ずレンダリングし、1秒間隔でポーリングする。**クラス名・ポーリング挙動を変えないこと。**
2. **room_id 解決**: `room_id → dアニメストアのリダイレクト URL` は新バックンド API
   `GET /api/v1/anime-store/lobby/{room_id}` で解決する（旧 Django `web/views.py:AnimeRoomLobby` のサーバ側生成を置換）。
   このエンドポイントは **backend サブモジュール側で別途実装が必要**。仕様は
   [docs/backend-lobby-endpoint.md](./docs/backend-lobby-endpoint.md)。`openapi/openapi.json` に定義済みで
   `pnpm api:generate` でクライアント生成済み。
3. リダイレクト判定: `"true"`→ dアニメストアへ / `"false"`→ webstore（要アップデート）/ 10秒無応答 → webstore（未インストール）。

## 拡張機能とのスタック共通化

UI コンポーネント（`components/ui/*`）・`lib/utils.ts`・テーマトークン（`globals.css`）・orval 設定は
Chrome 拡張機能リポジトリと意図的に同一にしている。変更する際は両者の整合に留意すること。

> 注意: ロビーの拡張機能結合（`content-version` の DOM 書き込み）は `d-party.net` 実ホスト、または拡張機能
> manifest の一時的な match 追加でしか完全検証できない。それ以外の挙動（webstore フォールバック等）はローカルで検証可能。
