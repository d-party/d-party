# AGENTS.md — backend

Django バックエンド。中心は WebSocket（Channels）によるルーム内の再生同期で、ほかに
REST API（統計・バッジ・拡張機能のバージョン確認・ロビー解決）と管理画面を持つ。
公開ページは `../frontend` が持ち、nginx が `/api`・`/admin`・`/anime-store/party/` だけを
Django へ振り分ける。

| 項目 | 採用 |
| --- | --- |
| 言語 / 依存管理 | Python 3.15 / uv（`pyproject.toml` · `uv.lock`） |
| フレームワーク | Django 6 · Channels 4 · DRF（スキーマは drf-spectacular）· djangochannelsrestframework |
| ASGI | 本番 gunicorn + uvicorn-worker / dev（`DEBUG=1`）runserver |
| DB / レイヤ | PostgreSQL 19 / Redis 8（`channels-redis`） |
| Lint・型 | ruff（format · lint · import 順序 · SAST · 複雑度）/ mypy（django-stubs · drf-stubs） |
| テスト | pytest（pytest-django · pytest-asyncio · factory-boy · pytest-cov） |

```
d_party/        settings.py · asgi.py（ProtocolTypeRouter / OriginValidator）· urls.py
                · workers.py（gunicorn の worker。WebSocket の 1 メッセージの上限）
streamer/       同時視聴のコア
  consumers.py    AnimePartyConsumer（create / join / leave / video_operation / reaction …）
  format.py       pydantic のメッセージ定義（公開プロトコル。受信の検証と送信の形）
  repository.py   consumer が await で呼ぶ永続化（ルーム・参加者・設定）
  reactions.py    リアクションの集計（ルーム終了時の ReactionStat への畳み込み · 種別ごとの累計）
  models.py       AnimeRoom / AnimeUser / AnimeReaction / AnimeRoomHistory / Setting / ReactionStat
  mixins.py       LogicalDeletionMixin（論理削除）
  fields.py       EncryptedCharField（Fernet）
  management/commands/close_active_sessions.py   起動時の ghost 回収
  management/commands/close_expired_rooms.py     48 時間を超えたルームの強制クローズ（cron）
announcements/  拡張機能に出す短いお知らせ（announcements テーブル · 管理画面）
api/            DRF（統計 · shields バッジ · バージョン確認 · ロビー解決 · 配信中のアナウンス）
templates/admin/ 管理画面トップ（Unfold ダッシュボード）· ログイン画面とパスキー一覧への差し込み
entrypoint.sh   close_active_sessions → runserver / gunicorn
conftest.py     テストでは InMemoryChannelLayer を使う
manage.py       /env_files/*.env があれば読む
```

compose・nginx・env はルートが持ち、`backend/` は build context として参照される。
ホストの解決先は env（`DATABASE_HOST` · `REDIS_HOST` など）で差し替える。
env を読むのは `settings.py` だけにし、ほかは `django.conf.settings` から参照する。
任意の env は `STATS_CACHE_SECONDS`（統計 API と shields バッジのキャッシュ秒数。既定 300）。

## 壊してはいけないもの

- **WebSocket プロトコル**: `format.py` の `action` 値・フィールド名・ネストは
  `extension/src/domain/protocol.ts` と一致させる。基底型のフィールド（`response`）は
  `SerializeAsAny` を付けないとサブクラスのフィールドが直列化で落ちる。
- **受信の検証**: クライアントの入力は `format.py` の `*Request` で検証する。長すぎる文字列は
  弾かずに切り詰める（保存する値の上限は `models.py`、配信するだけの値の上限は `format.py` の
  定数）。配信するだけの値にも上限を付ける（ルームの全接続へ渡るので）。検証エラーや想定外の
  例外では、`handle_exception` が退室の後始末をしてから接続を閉じる。例外を素通しすると
  `disconnect` が呼ばれず、在室者の行が alive のまま残る。
  - JSON として読めない・オブジェクトでない・バイナリ・大きすぎるフレームは、DCRF の
    `handle_action` より前で落ちるので、`AnimePartyConsumer.receive` で同じ後始末をする。
  - 1 メッセージの上限は uvicorn の `ws_max_size`（既定 16 MiB）を `d_party/workers.py` で
    64 KiB にしている。`gunicorn.conf.py` の `worker_class` を `uvicorn_worker.UvicornWorker` に戻さない。
- **論理削除**: `objects.alive()` / `delete()`（論理）/ `delete(hard=True)`（物理）の意味を変えない。
- **暗号化**: `AnimeUser.user_name` の鍵は `SECRET_KEY` から作る。`SECRET_KEY` を変えると既存行は復号できない。
- **REST API**: `api/urls.py` のパスとレスポンスの形は外部から参照される（shields は `{"schemaVersion": 1, ...}`）。
  レスポンスの形は `api/serializers.py` に宣言し、`@extend_schema` の `operation_id` が
  TypeScript の関数名になる。変えたら `openapi.json` を再生成する（手順はルートの `AGENTS.md`）。
- **ヘルスチェック（`/api/v1/health`）**: PostgreSQL と Redis まで確かめ、どれかが落ちていれば 503
  （本文は空）。拡張機能は 200 以外で「ルームを作成」ボタンを無効にする。コンテナの
  liveness / readiness には使わない（DB の障害で django が再起動を繰り返すため。probe は TCP）。
  pytest は Redis なしで走るので、200 を期待するテストでは `_redis_ok` を差し替える。
- **アナウンス**: `GET /api/v1/announcements` は配信中（`starts_at` ≤ 現在 < `ends_at`）だけを
  開始が新しい順（種別は見ない。同じ開始なら id の大きい順）で返す。認証不要・読み取り専用で、作成・編集・削除は管理画面だけ（REST の書き込み口は
  作らない。作るなら認証と `IsAdminUser` を付ける。既定の `DEFAULT_AUTHENTICATION_CLASSES` は空）。
  `Cache-Control: public, max-age=60` なので、管理画面での変更は最大 60 秒遅れて届く。
  開始 < 期限は DB の制約でも守る。
  - 本文には Markdown のインラインリンク `[テキスト](URL)` だけを書ける（`announcements/links.py`）。
    URL は `https://` で始まり、ホストがあり、空白・制御文字・バックスラッシュ・ユーザー情報を含まないものだけ。
    許可しない URL・空のテキスト・崩れた書き方（`](` の名残り）は管理画面のフォームエラーにする。
    拡張機能の `domain/announcementText.ts` が同じ規則で読むので、片側だけ変えない。
  - 本文の上限は 2 つ。表示される文字数（リンクはテキストだけを数え、URL は数えない）が
    `MESSAGE_DISPLAY_MAX_LENGTH`（60。拡張機能の幅に合わせている）、URL を含む生の文字列が
    `MESSAGE_RAW_MAX_LENGTH`（500。DB の列の長さ）。
  - API は本文を生の文字列のまま返す（形は変えない）。リンクに対応していない古い拡張機能では
    `[テキスト](URL)` がそのまま出るので、リンクを使う行は対象バージョンの下限を対応した版以上にする。
  - 配信対象の拡張機能のバージョンは、下限・上限（どちらも任意・両端を含む）で絞れる。
    `?extension_version=x.y.z` を付けると対象のものだけを返し、省略すると絞り込まない。形式が
    不正なら 400（`{"message": ...}`）。拡張機能は manifest の `version` を付けて呼ぶ。
  - バージョンは `announcements/versions.py` の `ExtensionVersionField` で、各部を 10 進 5 桁に
    詰めた整数（`2.15.0` → `2_00015_00000`）として `bigint` の 1 列に持つ。DB の比較が数値の
    順（`2.10.0` > `2.9.0`）になる。Python 側では `x.y.z` の文字列で扱い、比較の lookup に
    文字列を渡せる。受け付けるのは数字 3 つで、各部は 0〜65535（Chrome の manifest と同じ）。
    下限 ≤ 上限は `clean()` と DB の制約の両方で守る。
- **観覧専用（`spectate`）**: `AnimeUser` を作らずにグループへ読み取り参加する（人数・一覧・
  ホスト委譲・自動削除に影響しない）。フロントのタイマー画面が使う。`host_send` / `user_send` は
  `anime_user is None` を必ずガードする。フロントのオリジンから張るので `asgi.py` で `MY_DOMAIN` を許可している。
- **ルーム設定（`Setting`）**: create 時にすべて `False` で作る。変更はオーナー限定の
  `update_setting` で、`room_setting` をサーバから push する（クライアントからの read は無い）。
  - `one_way`：非オーナーの `video_operation` と `operation_notification` を捨てる
  - `owner_leave_delete`：オーナー退室でルームを消す
  - `disable_reaction`：配信も保存もしない
- **再生状態の問い合わせ**: `sync_request` はホストへだけ届き、`sync_response` はホストからしか
  受け付けない（設定に関係なく）。ゲストから通すと、宛先を選んで他人の再生を動かせる。
  ホストかどうかは接続が持つ値ではなく、`repository.refresh` した DB の値で判定する。
- **ghost の回収**: graceful でない停止で alive のまま残った行は、起動時の
  `close_active_sessions` が `updated_at` が 1 日以上前のものだけ論理削除する（別 Pod の稼働中セッションを巻き込まない）。
- **ルームの寿命**: 作成（`created_at`）から 48 時間を超えたルームは、在室中でも
  `close_expired_rooms` が強制クローズする（統計に alive のまま残さない）。ホストの `delete_room` と同じく
  リアクションを畳み込み、ユーザーとルームを論理削除し、`room_deleted` を配信する。起動時ではなく
  cron で走らせる（k3s では Helm の CronJob）。
- **管理画面のパスキー**: django-otp-webauthn。パスワードのログインも残している。
  - URL は `/admin/passkey/`。nginx が Django へ流すのは `/admin/` 配下だけなので外へ出さない。
    `urls.py` では `admin.site.urls` より前に置く。
  - RP ID は `MY_DOMAIN`。変えると登録済みのパスキーはすべて使えなくなる。dev（`localhost`）と
    本番のパスキーは別物。
  - 登録は管理画面の「パスキー」一覧から。登録済みのパスキーがあるアカウントへの追加は、
    パスキーでログインしたセッションからしかできない（ライブラリの仕様）。パスキーを失くしたら、
    パスワードで入って一覧から古い行を消すと登録し直せる。
  - ログイン試行のロック（django-axes、本番だけ有効）はユーザー名と IP の組で効く。IP は
    Cloudflare の `CF-Connecting-IP` から取り、IPv6 は /56 でまとめる（`d_party/client_ip.py`）。
    このヘッダーはクライアントが偽れるので、信頼できるのは Cloudflare を通ったときだけ。
    Cloudflare を通らずに nginx / django へ届く経路（NodePort · Ingress など）を作らない。
    クラスタ内の Pod からは届くので、同居するサービスは信頼している前提。ヘッダーが無いと
    本番では警告を出し、全員が nginx の IP として数えられる（ユーザー名だけのロックと同じ）。
  - テンプレートは Unfold のものをコピーせず、同名で継承してブロックだけ埋める
    （`login.html` の `login_after`）。要素の id は django-otp-webauthn のスクリプトとの契約。
- **CSP**: `settings.py` の `SECURE_CSP_REPORT_ONLY`（今は Report-Only。ブロックはしない）。
  インラインの `<script>` は許していないので、テンプレートに書くときは
  `<script {% csp_nonce_attr %}>` にする。外部のオリジンから読むものを足すなら方針にも足す。

## コマンド

```bash
uv sync
uv run ruff format --check . && uv run ruff check .
uv run mypy .        # settings が env を要求するので CI と同じダミー env を渡す
uv run pytest        # Redis は不要。PostgreSQL は要る（`test_<POSTGRES_DB>` を作って使う）
uv run pip-licenses
docker compose exec django python manage.py close_active_sessions
docker compose exec django python manage.py close_expired_rooms   # --hours で閾値を変えられる
```

コンテナ外で要る env: `SECRET_KEY` `DEBUG` `MY_DOMAIN` `POSTGRES_DB` `POSTGRES_PASSWORD`
`DATABASE_USER` `DATABASE_HOST` `DATABASE_PORT` `DATABASE_ENGINE` `REDIS_HOST` `REDIS_PORT`
`LANGUAGE_CODE` `TIME_ZONE` `D_ANIME_STORE_DOMAIN` `CHROME_EXTENSION_REQUIRED_VERSION`。
Dev Container からは `DATABASE_HOST=localhost` でつながる。

## テストとカバレッジ

- テストは対象のアプリの中に `test_<対象>.py` で置く（`tests.py` は consumer と API の既存分）。
- `uv run pytest --cov --cov-report=term-missing:skip-covered` で漏れている行と分岐が出る。
- 計測の設定は `pyproject.toml` の `[tool.coverage.*]`。分岐も数え、import されないファイルも
  0% として数える（`source = ["."]`）。
- 計測から外すのは、テストとその支援コード（`factories.py` · `conftest.py`）、生成物
  （`migrations/`）、プロセスの起動だけを担うもの（`manage.py` · `gunicorn.conf.py`。起動は
  `Backend / Build` が確かめる）に限る。テストを書けるコードを `omit` や `# pragma: no cover` で
  隠さない。

migration はコミット済み。モデルを変えたときだけ `makemigrations` して生成物をコミットする。

## CI

- `Backend / CI`：ruff · pytest（カバレッジは PR にコメントし、`python-coverage-comment-action-data` ブランチへ保存）· mypy · openapi（`openapi.json` が最新か）· license-check
- `Backend / Build`：hadolint → build → dockle → 実 PostgreSQL / Redis で migrate → 起動 → `/api/v1/health` が 200
- linter は ruff に集約する（SAST は `S`、複雑度は `C90`（10）と `PLR09xx`）。taint 解析だけは `Repo / CI` の CodeQL。
- フォーマットは検査のみで、自動コミットはしない。
- pre-commit の設定はルートの `.pre-commit-config.yaml`（`files: ^backend/`）。
