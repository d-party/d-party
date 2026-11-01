# AGENTS.md — backend

Django バックエンド。中心は WebSocket（Channels）によるルーム内の再生同期で、ほかに
REST API（統計・バッジ・拡張機能のバージョン確認・ロビー解決）と管理画面を持つ。
公開ページは `../frontend` が持ち、nginx が `/api`・`/admin`・`/anime-store/party/` だけを
Django へ振り分ける。

| 項目 | 採用 |
| --- | --- |
| 言語 / 依存管理 | Python 3.15 / uv（`pyproject.toml` · `uv.lock`） |
| フレームワーク | Django 6 · Channels 4 · DRF · djangochannelsrestframework |
| ASGI | 本番 gunicorn + uvicorn-worker / dev（`DEBUG=1`）runserver |
| DB / レイヤ | PostgreSQL 16 / Redis 7（`channels-redis`） |
| Lint・型 | ruff（format · lint · import 順序 · SAST · 複雑度）/ mypy（django-stubs · drf-stubs） |
| テスト | pytest（pytest-django · pytest-asyncio · factory-boy · pytest-cov） |

```
d_party/        settings.py · asgi.py（ProtocolTypeRouter / OriginValidator）· urls.py
streamer/       同時視聴のコア
  consumers.py    AnimePartyConsumer（create / join / leave / video_operation / reaction …）
  format.py       pydantic のメッセージ定義（公開プロトコル）
  models.py       AnimeRoom / AnimeUser / AnimeReaction / AnimeRoomHistory / Setting
  mixins.py       LogicalDeletionMixin（論理削除）
  fields.py       EncryptedCharField（Fernet）
  cron.py         fold_room_reactions（ルーム終了時にリアクションを ReactionStat へ畳み込む）
  management/commands/close_active_sessions.py
api/            DRF（統計 · shields バッジ · バージョン確認 · ロビー解決）
templates/admin/ 管理画面トップ（Unfold ダッシュボード）
entrypoint.sh   close_active_sessions → runserver / gunicorn
conftest.py     テストでは InMemoryChannelLayer を使う
manage.py       /env_files/*.env があれば読む
```

compose・nginx・env はルートが持ち、`backend/` は build context として参照される。
ホストの解決先は env（`DATABASE_HOST` · `REDIS_HOST` など）で差し替える。

## 壊してはいけないもの

- **WebSocket プロトコル**: `format.py` の `action` 値・フィールド名・ネストは
  `extension/src/domain/protocol.ts` と一致させる。基底型のフィールド（`response`）は
  `SerializeAsAny` を付けないとサブクラスのフィールドが直列化で落ちる。
- **論理削除**: `objects.alive()` / `delete()`（論理）/ `delete(hard=True)`（物理）の意味を変えない。
- **暗号化**: `AnimeUser.user_name` の鍵は `SECRET_KEY` から作る。`SECRET_KEY` を変えると既存行は復号できない。
- **REST API**: `api/urls.py` のパスとレスポンスの形は外部から参照される（shields は `{"schemaVersion": 1, ...}`）。
- **観覧専用（`spectate`）**: `AnimeUser` を作らずにグループへ読み取り参加する（人数・一覧・
  ホスト委譲・自動削除に影響しない）。フロントのタイマー画面が使う。`host_send` / `user_send` は
  `anime_user is None` を必ずガードする。フロントのオリジンから張るので `asgi.py` で `MY_DOMAIN` を許可している。
- **ルーム設定（`Setting`）**: create 時にすべて `False` で作る。変更はオーナー限定の
  `update_setting` で、`room_setting` をサーバから push する（クライアントからの read は無い）。
  - `one_way`：非オーナーの `video_operation` を捨てる
  - `owner_leave_delete`：オーナー退室でルームを消す
  - `disable_reaction`：配信も保存もしない
- **ghost の回収**: graceful でない停止で alive のまま残った行は、起動時の
  `close_active_sessions` が `updated_at` が 1 日以上前のものだけ論理削除する（別 Pod の稼働中セッションを巻き込まない）。

## コマンド

```bash
uv sync
uv run ruff format --check . && uv run ruff check .
uv run mypy .        # settings が env を要求するので CI と同じダミー env を渡す
uv run pytest        # Redis は不要。PostgreSQL は要る
uv run pip-licenses
docker compose exec django python manage.py close_active_sessions
```

コンテナ外で要る env: `SECRET_KEY` `DEBUG` `MY_DOMAIN` `POSTGRES_DB` `POSTGRES_PASSWORD`
`DATABASE_USER` `DATABASE_HOST` `DATABASE_PORT` `DATABASE_ENGINE` `REDIS_HOST` `REDIS_PORT`
`LANGUAGE_CODE` `TIME_ZONE` `D_ANIME_STORE_DOMAIN` `CHROME_EXTENSION_REQUIRED_VERSION`。

migration はコミット済み。モデルを変えたときだけ `makemigrations` して生成物をコミットする。

## CI

- `Backend/CI`：ruff · pytest（カバレッジは PR にコメントし、`python-coverage-comment-action-data` ブランチへ保存）· mypy · license-check
- `Backend/Build`：hadolint → build → dockle → 実 PostgreSQL / Redis で migrate → 起動 → `/api/v1/health` が 200
- linter は ruff に集約する（SAST は `S`、複雑度は `C90`（10）と `PLR09xx`）。taint 解析だけは `Repo/CI` の CodeQL。
- フォーマットは検査のみで、自動コミットはしない。
- pre-commit の設定はルートの `.pre-commit-config.yaml`（`files: ^backend/`）。
