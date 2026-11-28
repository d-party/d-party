# AGENTS.md — frontend

公開サイト（LP · 利用マニュアル（使い方） · Q&A · 統計 · ルームのロビー · タイマー）。

- Next.js 16（App Router · Turbopack）· React 19 · TypeScript（strict）· Tailwind CSS v4 · shadcn/ui
- primitive と `cn` は `@d-party/ui`。`Button` だけ `src/components/ui/button.tsx` に自前で持つ。
  テーマトークン（`globals.css`）と orval の設定は拡張機能と揃えている。
- REST クライアントは orval で生成（`../backend/openapi.json` → `src/infrastructure/api/generated/`）。
- 接続先は `src/infrastructure/env.ts`（`NEXT_PUBLIC_*` で上書き、既定 `localhost`）。
  環境変数を読むのはこのファイルだけ。

```
src/
  app/                          ページ（/ · docs/* · stats · qa · privacy · anime-store/lobby/[roomId] · not-found）
                                + opengraph-image / twitter-image
  components/
    landing/ layout/ motion/ qa/ stats/
    docs/                       利用マニュアルの章立て（chapters.ts）· 本文の部品 · 画像の一覧（images.ts）
    lobby/                      LobbyView（ロビーの client 部分。ページは metadata と Suspense だけ）
    timer/                      TimerView · openTimerPopup
    og/                         OGP カード（OgCard · SiteOgImage · RoomOgImage）
  infrastructure/               env.ts · api/（orval）· ws/timerClient.ts
  lib/metadata.ts               pageMetadata() · サイト名などの共通値
  lib/links.ts                  外部リンク · ロビー / タイマーのパス
  lib/og/                       カードのサイズ · フォント
```

```bash
pnpm dev              # :3000
pnpm build            # standalone
pnpm api:generate && pnpm typecheck && pnpm lint
pnpm storybook
```

`next.config.ts` の `agentRules: false` を外さない。外すと `next dev` がこのファイルへ英語のブロックを
書き足し続ける。

## ロビー `/anime-store/lobby/[roomId]` — 契約

拡張機能と backend の両方と結合しているので変えないこと。

1. 拡張機能の `content-version` が `.chrome_extension_field` の `innerText` に `"true"` / `"false"`
   を書く。ページはこの要素を必ず描画し、1 秒ごとに読む。拡張機能が hydrate より先に
   書いても消えないよう、React には中身を触らせない（`dangerouslySetInnerHTML`）。
2. `room_id` から dアニメストアの URL への解決は backend の `GET /api/v1/anime-store/lobby/{room_id}`。
3. `"true"` なら dアニメストアへ移動する。`"false"` か 30 秒無応答なら、「タイマーを見る」と
   「インストール / アップデート」の選択肢を出す。

拡張機能との結合は `d-party.net` か、dev ビルドの拡張機能（`http://localhost/anime-store/lobby/*`）で確かめる。

## タイマー画面（`?timer=true`）

拡張機能を持たない人向け。backend の `spectate` で WS につなぎ、既存の `video_operation`
ブロードキャストから再生位置を計算する（こちらからは送らない）。初期タイトルはロビー解決 API、
以降は `video_operation.title`。`useSearchParams` を使うのでページを `Suspense` で包む。

`?timer=true&popup=1` は `openTimerPopup(roomId)` が開く 380×280 の小窓。`TimerView` が
`fixed inset-0` で Header / Footer を覆う。ポップアップがブロックされたら同じタブで開く。

## 利用マニュアル `/docs`

- 「使い方」はこのマニュアルに一本化している。旧 `/usage` のページは廃止した。サイト内のリンクは
  `/docs` を直接指す。
- **暫定の転送**: `/usage` は `next.config.ts` の `redirects` で `/docs` へ **307** で転送している
  （クエリは引き継ぐ）。インストール済みの古い版（v2.14.1 以前）の拡張機能が、ポップアップの
  「情報」タブの「使い方」と初回インストール時に開くページで `/usage` を開くため。
  将来外すので、ブラウザに恒久的にキャッシュされる 308 にはしない。
  - 外す条件: `/docs` を指す版の拡張機能が行き渡ったら。目安は、その版（v2.14.1 の次のリリース）を
    Chrome ウェブストアに出してから 3 か月。
  - 外すときは次も一緒に直す（`/usage` の 307 を確かめている所）。外したあと `/usage` は 404 になる。
    - `next.config.ts` の `redirects`
    - `.github/workflows/frontend-build.yml` の「Check the pages render」
    - `.claude/skills/maintenance/scripts/gates.sh` の `expect_status /usage 307`
    - `.claude/skills/dependabot-review-and-merge/SKILL.md` のスモークテスト
    - この節と、`extension/src/infrastructure/env.ts` の `DOCS_URL` のコメント
- 章の並び・タイトル・説明は `components/docs/chapters.ts` の 1 か所。目次・前後リンク・メタデータ・
  sitemap はここから作る。章を足すときは `app/docs/<slug>/page.tsx` と一緒にここへ足す。
- 画像は `public/img/docs/*.webp`（WebP・2 倍解像度）で、寸法は `components/docs/images.ts` に持つ。
  スクリーンショットはすべて架空のデータ（作品「星降る町の喫茶店」第 3 話、参加者「さくら」（オーナー）
  「たけし」「ゆうき」、2026-11-27 21 時台の JST）で撮る。撮り直すときもこの設定に合わせる。
  アナウンスも架空の文言（`extension/src/manual/fixtures.tsx` の `MANUAL_ANNOUNCEMENTS`）を使う。
- UI はダークモードで撮る（playwright の `colorScheme: "dark"`）。拡張機能はライトの配色も持っているが、
  マニュアルにはライトの画面を載せず、ライト / ダークの切り替えも説明しない。
  拡張機能の画面は extension の Storybook `Manual/*`（`extension/src/manual/`）を、
  ロビーとタイマーは API と WebSocket を playwright の route でモックして撮る。
- 拡張機能の画面（サイドバー・ポップアップ・設定タブ）を変えたら、マニュアルの記述と画像も見直す。

## OGP

- サイト共通（`SiteOgImage`）はビルド時に PNG 化する。ルーム別（`RoomOgImage`）は作品名を引くので動的。
- `next/og`（Satori）の制約で、カードはインラインスタイルと flexbox だけで書く（Tailwind 不可）。
  Storybook の `OGP/*` でそのまま確認できる。日本語フォントは `public/fonts/` から読む。
- フォントは `loadOgCardFonts()` から渡す（`lib/og/fonts.ts`）。読めなければカードを描かずに 500 にする
  （next/og の既定のフォントは日本語を持たず、毎回フォントを取りに行って溜める）。ファイルは 1 度だけ読み、
  Satori の解析のキャッシュ（Buffer がキー）を効かせる。解析済みのフォントは描いた字形を
  捨てないので、描いた文字が一定数を超えたら Buffer を作り直してキャッシュを入れ替える。
  配列は毎回新しく作る（Satori が配列をキーにして足していくため）。
- ルーム名のように誰でも決められる文字列は `loadOgCardFonts(title)` が返す `title` を使う。
  フォントに無い文字を落とし、カードに出る長さで切る（`ogSafeTitle`）。残すと `next/og` が
  Google Fonts から取ってきて、消えないキャッシュに溜める。
- ページが `openGraph` を定義すると、親の `openGraph` は画像ごと置き換わる。そのため
  `pageMetadata()` は `/opengraph-image` と `/twitter-image` を明示している。
- `twitter-image.tsx` は隣の `opengraph-image.tsx` を再 export するだけ。

## Docker

ビルドコンテキストはルート。Next の `outputFileTracingRoot` がワークスペースのルートになるので、
standalone は `standalone/frontend/server.js` + `standalone/node_modules` の形になり、
runner のレイアウトと `CMD` もそれに合わせてある。

## CI

`Frontend / CI`（生成物の drift · typecheck · lint · license-check）と
`Frontend / Build`（next build · storybook · イメージを起動してページ疎通）。
