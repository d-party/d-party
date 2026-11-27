# AGENTS.md — extension

dアニメストアのページに注入して同時視聴を実現する Manifest V3 拡張機能。

- TypeScript（strict）· React 19 · rspack（swc）· Tailwind CSS v4 · shadcn/ui
- primitive と `cn` は `@d-party/ui`。`Button` だけ `src/components/ui/button.tsx` に自前で持つ。
- REST クライアントは orval で生成（`../backend/openapi.json` → `src/infrastructure/api/generated/`）。
  生成物はコミットし、CI が差分ゼロを確かめる。

```
src/
  domain/          フレームワーク非依存の型とロジック
    protocol.ts      WS メッセージ型（backend streamer/format.py と 1 対 1）
    roomSettings.ts  ルーム設定
  application/     ユースケースとポート
    RoomSession.ts   再生同期のオーケストレーション
    ports.ts         PartySocket / PlayerController / SidebarView / Notifier などの境界
    ActionGuard.ts   受信した操作を送り返さないためのフラグ
  infrastructure/  ws/ · storage/（chrome.storage.sync / local）· notifier/ · api/ · env.ts
  styles/          theme.css（popup と sidebar が共有するテーマトークン）· sidebar.css
  presentation/    注入先ごとのエントリ
    background/      service worker
    content/store/   作品ページ
    content/party/   プレイヤーページ（サイドバー・プレイヤー・リアクション）
    content/version/ ロビーでのバージョン確認
    popup/           設定 UI
  manual/          frontend の利用マニュアル（/docs）を撮るための Storybook の場面（Manual/*）。架空のデータだけを使い、
                   ダークモード（prefers-color-scheme: dark）で撮る
```

rspack のエントリは `background` · `content-store` · `content-party` · `content-version` ·
`popup` · `sidebar-style`。ページへ直接当てる CSS は `manifest.json` の `css`（`public/css/`）で
注入し、Shadow DOM 用の CSS（`sidebar-style`）だけをバンドルして実行時に読み込む。

## 約束

- `application/` は `infrastructure/` を import しない。WebSocket は `ports.ts` の `PartySocket`、
  共有リンクの URL は `RoomSessionDeps.shareLinkFor` で受け取る。
- `domain/protocol.ts` は backend の `streamer/format.py` と一致させる。アクション名・
  メッセージの形・`option.paused` / `rate` の文字列表現を変えない。
- `video_operation` には任意の `title` を付ける（通常の操作と 5 秒ごとのハートビートの両方）。
  フロントのタイマー画面がエピソードの切り替えに追従するため。
- ルーム設定は create メッセージに含めず、create の後にオーナーが `update_setting` で送る。
  現在値はサーバの `room_setting` で受け取る。一方通行では非オーナーは `video_operation` を送らず、
  リアクション禁止では送信せず自分にだけ表示する（`RoomSession`）。
- 共有パネルの「タイマーのみの URL」はロビー URL に `?timer=true` を付けたもの。
- 初回インストール時に開くページとポップアップ「情報」タブの「使い方」は、公開サイトの利用マニュアル
  （`DOCS_URL` = `/docs`）。開いたかどうかの記録は `chrome.storage.local` の `usagePageOpened`
  （旧 `/usage` の頃の名前）。キーを変えると既存の利用者にもう一度開くので変えない。
- アナウンス（`components/Announcements.tsx`）はポップアップではタブの上、サイドバーでは
  ヘッダーの下に出す。ポップアップは backend を直接、content script は background 経由
  （`{ type: "announcements" }`）で取る。どちらも orval のクライアントの引数で
  `extension_version`（manifest の `version`）を送り、配信対象のものだけを受け取る（取れない
  環境では付けない）。取得の失敗は空として扱い何も出さない。× で閉じた ID は
  `chrome.storage.local` の `dismissedAnnouncementIds` に残し、両方で二度と出さない。
  見た目は控えめなテキスト行で、重要（`warning`）は色だけに頼らず警告アイコンと「重要」の文字で
  お知らせ（`info`）と区別する。

## ビルドと読み込み

```bash
pnpm build          # localhost（http / ws）向け → dist/
pnpm build:prod     # d-party.net（https / wss）向け。manifest から localhost の権限を除く
pnpm dev            # rspack --watch
pnpm api:generate && pnpm typecheck && pnpm lint
pnpm storybook      # :6006
```

接続先はビルド時の `D_PARTY_ENV` を `DefinePlugin` がリテラルに置き換える（`src/infrastructure/env.ts`）。
`chrome://extensions` の「パッケージ化されていない拡張機能を読み込む」で `dist/` を選ぶ。

対象ページ:

- `https://animestore.docomo.ne.jp/animestore/*`（`anime.dmkt-sp.jp` も同じ。プレイヤーは `sc_d_pc`）
- `https://d-party.net/anime-store/lobby/*`（dev は `http://localhost/anime-store/lobby/*`）

content script の DOM 操作は、有料の dアニメストア実ページでしか最終確認できない。
実ページから localhost の backend へつなぐには `chrome://flags/#block-insecure-private-network-requests`
を Disabled にする。

## リアクション素材

アニメーションは Google Noto Emoji（Apache-2.0）の Lottie。既定 5 種とエクストラ最大 200 種を
`src/presentation/content/party/react/reactions/lottie/` に同梱する。エクストラを静的 import
しているので `content-party` は十数 MB になる。静的アイコンは react-icons と lucide。

## CI

`Extension/CI`（生成物の drift · typecheck · lint · license-check）と
`Extension/Build`（build:prod と manifest の参照先の実在確認 · zip · storybook）。
