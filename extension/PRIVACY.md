# プライバシーポリシー / Privacy Policy

最終更新日: 2026-10-12

本ポリシーは、Chrome 拡張機能 **d-party**（以下「本拡張機能」）および
これに付随するウェブサイト `https://d-party.net`、ならびにバックエンドサービス
（以下総称して「本サービス」）における利用者情報の取り扱いについて定めるものです。

本サービスは、株式会社 NTT ドコモが運営する「dアニメストア」上で、利用者同士が
動画の再生・一時停止・シーク等を同期して同時視聴（ウォッチパーティー）するための
機能を提供します。本サービスは dアニメストアの公式サービスではなく、有志による
非営利のオープンソースプロジェクトです。

## 1. 運営者

- プロジェクト名: d-party
- 運営: d-party 開発チーム（個人有志によるオープンソースプロジェクト）
- ソースコード: <https://github.com/d-party>
- 連絡先: 上記 GitHub Organization の各リポジトリの Issue

## 2. 取得する情報と利用目的

本サービスは、サービスの提供に必要最小限の情報のみを取得します。

### 2.1 本拡張機能がローカルに保存する情報

以下の情報は、利用者のブラウザ内（`chrome.storage.sync`）にのみ保存され、
本サービスのサーバには送信されません（Chrome の同期設定により Google アカウントを
通じて利用者自身の他端末と同期される場合があります）。

| 項目 | 内容 | 目的 |
|---|---|---|
| 表示名・表示アイコン | ルーム内で表示するニックネームとアイコンの種類 | 同時視聴ルームでの識別 |
| 表示・動作の設定 | リアクションの表示方法、追加したエクストラリアクション、通知・別タブ・ピクチャーインピクチャー等の設定 | 拡張機能の動作の切り替え |
| 個人の利用統計 | 作成・参加したルーム数、送信したリアクション数、接続時間の合計 | ポップアップでの表示（サーバには送信しません） |

このほか、初回インストール時に使い方ページを開いたかどうかのフラグを `chrome.storage.local` に保存します。

### 2.2 ルーム参加時にサーバへ送信される情報

利用者が同時視聴ルームを作成・参加した際に、WebSocket 経由でバックエンドへ
以下の情報が送信され、必要な期間サーバに保存されます。

| 項目 | 内容 | 保存形式 |
|---|---|---|
| ルーム ID | サーバが生成するランダム UUID | 平文 |
| 視聴中作品の `part_id` | dアニメストアのエピソード識別子 | 平文 |
| ユーザー ID | サーバが生成するランダム UUID（アカウントではない） | 平文 |
| 表示名 | 上記 2.1 の表示名 | **暗号化して保存**（Fernet / `cryptography`） |
| 表示アイコン | 上記 2.1 のアイコンの種類 | 平文 |
| 作品タイトル | ルーム作成時に開いていたエピソードのタイトル（ページの表示から取得） | 平文。ルームのリンクの OGP 画像・タイマー画面の表示に使用 |
| ホスト権限フラグ | ルーム作成者かどうか | 平文 |
| ルームの詳細設定 | 一方通行モード・オーナー退室時の自動削除・リアクション禁止 | 平文 |
| 参加・退室の日時 | ユーザー情報の作成日時・退室日時 | 平文。参加人数と統計に使用 |
| プレイヤー操作イベント | 再生 / 一時停止 / シーク位置 / 再生速度 / 視聴中のエピソードタイトル | 同期のため一時的にメモリ上で配信。永続化されない |
| リアクション | 5 種類のデフォルトリアクション（cry / smile / thumbs_up / fav / middle_finger）とエクストラリアクション | デフォルトリアクションは統計目的で保存し、ルーム終了時に日別・種類別の件数へ集計。エクストラリアクションは配信のみで保存しない |

ルームの共有リンクを知っている人は、拡張機能が無くてもタイマー画面（`?timer=true`）から
そのルームの作品タイトルと再生状況（再生中かどうか・再生位置）を閲覧できます。

**本サービスは以下の情報を取得しません。**

- 氏名、メールアドレス、電話番号、住所等の個人を直接識別する情報
- dアニメストアのアカウント情報、ログイン認証情報、パスワード
- クレジットカード情報、決済情報
- IP アドレスの長期保存（リクエストログとして一時的に記録される場合があります）
- 視聴履歴（どの作品のどのエピソードを再生したかは `part_id` 単位で
  ルーム情報として一時的に保持されますが、利用者個人に紐づけた視聴履歴は
  作成しません）
- 行動ターゲティング広告のためのトラッキング情報

### 2.3 自動的に取得される情報

サーバ運用のため、Nginx のアクセスログ（アクセス日時・リクエスト先・ステータス
コード等）を取得しますが、これは障害対応を目的とした記録であり、個人を特定する
目的では利用しません。

## 3. 情報の利用目的

取得した情報は、以下の目的のためにのみ利用します。

1. 同時視聴機能の提供（プレイヤー状態の同期、リアクション配信）
2. ルーム参加人数等の表示
3. サービス全体の利用統計（公開ページ `/stats` で匿名集計値として表示）
4. 不正利用・障害対応のための調査
5. サービス品質の改善

## 4. 第三者提供

取得した情報を、利用者の同意なく第三者に提供することはありません。
ただし、以下の場合を除きます。

- 法令に基づき開示が求められる場合
- 人の生命・身体・財産の保護のために必要であり、本人の同意取得が困難な場合

## 5. 外部サービスとの関係

本サービスは以下の外部サービスと関連しますが、これらは本サービスの運営者とは
**別事業者**であり、それぞれのプライバシーポリシーが適用されます。

- **dアニメストア**（株式会社 NTT ドコモ）: 動画配信の本体。本サービスは
  dアニメストアの提供者ではありません。
- **Google Chrome / Chrome Web Store**（Google LLC）: 本拡張機能の配布基盤。
- **GitHub**（GitHub, Inc.）: ソースコードのホスティング。
- **Google Fonts**（Google LLC）: dアニメストアの一覧ページで拡張機能が追加するボタンのアイコン
  （Material Icons）を `fonts.googleapis.com` から読み込みます。このとき利用者のブラウザから
  Google へリクエストが送られます。
- **Cloudflare**（Cloudflare, Inc.）: 本番環境では、ウェブサイトとバックエンドへの通信が
  Cloudflare を経由します。

## 6. データの保存期間

- **ルームと参加ユーザー**（表示名・表示アイコン・作品タイトルを含む）:
  退室やルームの終了で無効化（論理削除）されますが、現在のところデータベースからの
  物理削除は行っていません。表示名は暗号化して保存されており、復号鍵を失った場合は
  読み出し不能となります。
- **リアクション**: ルームの終了時に日別・種類別の件数へ集計され、個々の記録は削除されます。
- **公開統計**: 集計値（参加人数、リアクション数等）は匿名化された集計
  情報として保持される場合があります。

## 7. Cookie 等のトラッキング技術

本サービスのウェブサイトは、サービスの動作に必要な最小限のもの以外、
広告・解析目的の Cookie を使用しません。Google Analytics 等の第三者
トラッキングは導入していません。

## 8. 拡張機能の権限について

本拡張機能は Manifest V3 に基づき、以下の権限を要求します。

| 権限 | 用途 |
|---|---|
| `storage` | 上記 2.1 の設定情報をブラウザに保存するため |
| `host_permissions: https://anime.dmkt-sp.jp/*`, `https://animestore.docomo.ne.jp/*` | dアニメストア上で同時視聴 UI を表示し、プレイヤーの状態を取得・制御するため |
| `host_permissions: https://d-party.net/*` | ロビーページでバージョン確認を行うため |

これらの権限は、上記目的の範囲外（例: dアニメストア上での操作内容の
収集・送信、他サイトの閲覧情報の取得等）には使用しません。

## 9. 利用者の権利

利用者は、本サービスに保存されている自身に関する情報について、以下のことが
可能です。

- **削除**: ルームから退室することで、参加ユーザー情報は無効化（論理削除）されます。
  ルーム自体が無人になれば、ルームも無効化されます（上記 6 のとおり物理削除はしていません）。
- **設定の消去**: Chrome の拡張機能管理画面から本拡張機能を削除することで、
  `chrome.storage` 上の設定情報が消去されます。
- **問い合わせ**: その他の照会・削除依頼は GitHub Issue にてご連絡ください。

なお、本サービスは利用者を直接識別する情報を取得していないため、
特定個人に紐づくデータの個別開示・訂正には対応できない場合があります。

## 10. セキュリティ

- 表示名は Fernet（AES-128-CBC + HMAC-SHA256）により暗号化のうえ保存します。
- 本サービスへの通信は HTTPS / WSS により暗号化されます（本番環境）。
- ソースコードは MIT License の下でオープンソースとして公開されており、
  第三者による監査が可能です。

## 11. 未成年者の利用

dアニメストアの利用規約に従ってください。本サービス独自に未成年者から
別途同意を取得することはありません。

## 12. 本ポリシーの変更

本ポリシーは、必要に応じて改定されることがあります。改定後の内容は本ファイル
（GitHub リポジトリ）および公式サイト `https://d-party.net/privacy` に
掲載された時点で効力を生じます。重要な変更がある場合は、GitHub リリース等で
お知らせします。

## 13. お問い合わせ

本ポリシーに関するお問い合わせは、以下までお願いします。

- GitHub: <https://github.com/d-party>
- リポジトリの Issue: <https://github.com/d-party/d-party/issues>

---

# Privacy Policy (English summary)

This Chrome extension ("d-party") and its companion website
`https://d-party.net` provide a watch-party feature for the Japanese video
streaming service "dアニメストア" (operated by NTT DOCOMO, INC.).
d-party is an unofficial, non-commercial, open-source project.

**Data we collect**

- Locally (in `chrome.storage.sync`, never sent to our servers): your
  display name and icon, display/behaviour settings, and personal usage
  statistics (rooms created/joined, reactions sent, time connected).
- On our servers when you create or join a room: a random room UUID, a random
  user UUID, the dアニメストア episode identifier (`part_id`) and episode
  title, your display name (stored encrypted with Fernet) and icon, host flag,
  room settings, join/leave timestamps, real-time player events (not
  persisted), and the five default reactions (aggregated into daily counts
  when the room ends; extra reactions are relayed but not stored).
- Anyone with a room's share link can see its episode title and playback
  state on the timer page, without the extension.

**What we do NOT collect**

- Personal identifiers (name, email, phone, address)
- dアニメストア account credentials
- Payment information
- Cross-site tracking data, advertising identifiers
- Per-user viewing history beyond the lifetime of a room

**Retention.** Rooms and participants are deactivated (soft-deleted) when
people leave or the room ends, but are not currently purged from the
database. Reactions are reduced to daily counts when a room ends. Removing
the extension clears all locally-stored settings.

**Third parties.** d-party does not sell or share user data with third
parties. Related services (dアニメストア, Google Chrome Web Store, GitHub,
Google Fonts, Cloudflare) are operated by their respective providers under
their own privacy policies.

**Contact.** Please open an issue at
<https://github.com/d-party/d-party/issues>.
