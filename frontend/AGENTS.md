# AGENTS.md — frontend

公開サイト（LP · 使い方 · Q&A · 統計 · ルームのロビー · タイマー）。

- Next.js 16（App Router · Turbopack）· React 19 · TypeScript（strict）· Tailwind CSS v4 · shadcn/ui
- primitive と `cn` は `@d-party/ui`。`Button` だけ `src/components/ui/button.tsx` に自前で持つ。
  テーマトークン（`globals.css`）と orval の設定は拡張機能と揃えている。
- REST クライアントは orval で生成（`../backend/openapi.json` → `src/infrastructure/api/generated/`）。
- 接続先は `src/infrastructure/env.ts`（`NEXT_PUBLIC_*` で上書き、既定 `localhost`）。

```
src/
  app/                          ページ（/ · usage · stats · qa · anime-store/lobby/[roomId] · dmm-tv/lobby/[roomId] · not-found）
                                + opengraph-image / twitter-image
  components/
    landing/ layout/ motion/ qa/ stats/
    timer/                      TimerView · openTimerPopup
    og/                         OGP カード（OgCard · SiteOgImage · RoomOgImage）
  infrastructure/               env.ts · api/（orval）· ws/timerClient.ts
  lib/metadata.ts               pageMetadata()
  lib/og/                       カードのサイズ · フォント · PNG 化
```

```bash
pnpm dev              # :3000
pnpm build            # standalone
pnpm api:generate && pnpm typecheck && pnpm lint
pnpm storybook
```

## ロビー `/anime-store/lobby/[roomId]` — 契約

拡張機能と backend の両方と結合しているので変えないこと。

1. 拡張機能の `content-version` が `.chrome_extension_field` の `innerText` に `"true"` / `"false"`
   を書く。ページはこの要素を必ず描画し、1 秒ごとに読む。
2. `room_id` から dアニメストアの URL への解決は backend の `GET /api/v1/anime-store/lobby/{room_id}`。
3. `"true"` なら dアニメストアへ移動する。`"false"` か 30 秒無応答なら、「タイマーを見る」と
   「インストール / アップデート」の選択肢を出す。

DMM TV も同じ DOM 契約で `/dmm-tv/lobby/[roomId]` を持ち、`GET /api/v1/dmm-tv/lobby/{room_id}` で
再生ページ（`/vod/playback/on-demand/?season=..&content=..&party=join`）へ解決する。DMM のタイマー
画面はまだ無い。

拡張機能との結合は `d-party.net` か、dev ビルドの拡張機能（`http://localhost/anime-store/lobby/*`）で確かめる。

## タイマー画面（`?timer=true`）

拡張機能を持たない人向け。backend の `spectate` で WS につなぎ、既存の `video_operation`
ブロードキャストから再生位置を計算する（こちらからは送らない）。初期タイトルはロビー解決 API、
以降は `video_operation.title`。`useSearchParams` を使うのでページを `Suspense` で包む。

`?timer=true&popup=1` は `openTimerPopup(roomId)` が開く 380×280 の小窓。`TimerView` が
`fixed inset-0` で Header / Footer を覆う。ポップアップがブロックされたら同じタブで開く。

## OGP

- サイト共通（`SiteOgImage`）はビルド時に PNG 化する。ルーム別（`RoomOgImage`）は作品名を引くので動的。
- `next/og`（Satori）の制約で、カードはインラインスタイルと flexbox だけで書く（Tailwind 不可）。
  Storybook の `OGP/*` でそのまま確認できる。日本語フォントは `public/fonts/` から読む。
- ページが `openGraph` を定義すると、親の `openGraph` は画像ごと置き換わる。そのため
  `pageMetadata()` は `/opengraph-image` と `/twitter-image` を明示している。

## Docker

ビルドコンテキストはルート。Next の `outputFileTracingRoot` がワークスペースのルートになるので、
standalone は `standalone/frontend/server.js` + `standalone/node_modules` の形になり、
runner のレイアウトと `CMD` もそれに合わせてある。

## CI

`Frontend/CI`（生成物の drift · typecheck · lint · license-check）と
`Frontend/Build`（next build · storybook · イメージを起動してページ疎通）。
