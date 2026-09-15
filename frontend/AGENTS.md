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
    stats/page.tsx           統計（公開）— StatsDashboard（公開 stats API + 自前バーチャート）
    qa/page.tsx              Q&A（新規）— Faq アコーディオン
    anime-store/lobby/[roomId]/page.tsx
                             ルーム遷移（旧 lobby_redirect.html）— client component
    not-found.tsx            404（旧 404.html）
    opengraph-image.tsx twitter-image.tsx
                             サイト共通 OGP 画像（ビルド時に PNG 化）
    globals.css              Tailwind + shadcn テーマトークン（拡張機能 popup から移植、ダーク専用）
  components/
    layout/Header.tsx Footer.tsx
    landing/                 Hero / Features（framer-motion アニメーション）
    motion/Reveal.tsx        スクロール表示アニメ（prefers-reduced-motion 対応）
    qa/Faq.tsx               アコーディオン（client）
    og/                      OGP カード: OgCard（共通シェル）/ SiteOgImage / RoomOgImage
                             + brand.ts（配色・ロゴ）/ ogPreview.tsx（Storybook デコレータ）
    ui/                      shadcn コンポーネント（拡張機能と共通の Button 等）
  infrastructure/
    env.ts                   接続先設定（NEXT_PUBLIC_* で上書き可、旧 settings.js 相当）
    api/fetcher.ts           orval mutator（customFetch）
    api/generated/           orval 生成クライアント（コミット対象外でなく生成物を含む）
  lib/metadata.ts            各ページの meta / OGP テキストを組み立てる pageMetadata()
  lib/og/                    card.ts（サイズ・alt・画像ルートのパス）/ fonts.ts /
                             renderSiteImage・renderRoomImage（next/og で PNG 化）
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

## OGP / meta 情報

カードは 2 種類。どちらも `components/og/OgCard.tsx`（ブランドヘッダ + eyebrow/headline/sub +
フッタ）を共通シェルとして使うので、サイトのリンクとルームのリンクは同じ見た目になる。

- **サイト共通**（`SiteOgImage`）: `app/opengraph-image.tsx` / `app/twitter-image.tsx`。
  リクエスト依存が無いのでビルド時に 1 枚 PNG 化され、静的配信される。
- **ルーム個別**（`RoomOgImage`）: `app/anime-store/lobby/[roomId]/{opengraph,twitter}-image.tsx`。
  作品名をバックエンドから引いて描画するため動的。

Satori（`next/og`）の制約でカードは**インラインスタイル + flexbox のみ**（Tailwind 不可）。
そのぶん同じコンポーネントを **Storybook**（`OGP/SiteOgImage`・`OGP/RoomOgImage`）で
そのままプレビューできる。`pnpm storybook` で確認すること。日本語グリフは
`public/fonts/NotoSansJP-*.ttf` をディスクから読む（`lib/og/fonts.ts`）ので外部フェッチ無し。

各ページの meta テキストは `lib/metadata.ts` の `pageMetadata()` で組み立てる
（title / description / canonical / og / twitter）。**Next の落とし穴**: ページが自前の
`openGraph` を定義すると親から解決済みの `openGraph` を**丸ごと置き換える**ため、
`app/opengraph-image.tsx` のファイル規約で付く画像も消える。よって `pageMetadata()` は
画像 URL（`/opengraph-image`・`/twitter-image`）を明示的に指定している。

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
3. リダイレクト判定: `"true"`→ dアニメストアへ / `"false"`→（旧: webstore 自動遷移）**選択 UI** / 30秒無応答 →（旧: webstore 自動遷移）**選択 UI**。
   拡張機能が無い/非対応のときは、ウェブストアへ自動遷移する代わりに「**タイマーを見る**（`?timer=true`）or **インストール/アップデート**（webstore）」を提示する。`.chrome_extension_field` の DOM 契約・1秒ポーリングは不変。

### タイマー画面（`?timer=true`）

拡張機能なし・dアニメストア不要のユーザー向けに、**新規 URL を発行せず**ロビー URL に
`?timer=true` を付けたものをタイマー画面にする（`components/timer/TimerView.tsx`）。バックエンドの
`spectate`（観覧専用参加）で WS 接続し、既存の `video_operation` ブロードキャストを受信して
**計算で再生位置を再現**する（追加の WS 通信は行わない。`infrastructure/ws/timerClient.ts`）。
初期タイトルは `lobbyResolve` から、以後は `video_operation.title` で更新。WS は `MY_DOMAIN` の
オリジンから張るため、バックエンドの `OriginValidator` に `MY_DOMAIN` 許可が必要（backend 側で対応）。
`useSearchParams` を使うため、ページは `Suspense` 境界で包む（Next のビルド要件）。

**ポップアップ表示（`?timer=true&popup=1`）**: ロビーの選択 UI と、タイマー画面（`TimerView`、
別窓表示中を除く）の「別窓（ポップアップ）で開く」ボタンから、共通の `openTimerPopup(roomId)`
（`components/timer/openTimerPopup.ts`）で `window.open` する。タイマーを小さな別窓（380×280）
として開き、常に手前へ浮かせて再生状況を見られるようにする（ポップアップブロック時は同タブへ
フォールバック）。`popup=1` のとき `TimerView` は `fixed inset-0` の全面表示になり、レイアウトの
Header/Footer を覆って小窓に収める。

## 拡張機能とのスタック共通化

UI コンポーネント（`components/ui/*`）・`lib/utils.ts`・テーマトークン（`globals.css`）・orval 設定は
Chrome 拡張機能リポジトリと意図的に同一にしている。変更する際は両者の整合に留意すること。

> 注意: ロビーの拡張機能結合（`content-version` の DOM 書き込み）は `d-party.net` 実ホスト、または拡張機能
> manifest の一時的な match 追加でしか完全検証できない。それ以外の挙動（webstore フォールバック等）はローカルで検証可能。
