# AGENTS.md — loadtest

k6 で nginx → django → Redis / PostgreSQL の組み上がったスタックを叩き、WebSocket の
同時視聴同期を測る。使い方とメトリクスは [README.md](README.md)。

```
lib/protocol.js        送信メッセージ（action / request_id）の組み立てと遅延計測の埋め込み
lib/participant.js     1 WS 接続を Promise で扱う（connect / waitFor(action)）
lib/scenario.js        シナリオ共通の設定（env）・メトリクス・タイマー（every / delay）
scenarios/ws_party.js  1 VU = 1 ルーム。create → join → video / reaction → leave
scenarios/ws_oneway.js 一方通行モード。host だけが配信し、非オーナーの操作はブロックされる
scenarios/ws_timer.js  タイマー。host だけが配信し、spectate 参加者へ配信する
results/               k6 のサマリ出力（gitignore）
```

- 測るのは単発 RPS ではなく、多接続を張ったままのブロードキャストの捌き。
- ルートに置くのは、対象が compose・nginx・env を含むスタック全体だから。
- メッセージの形は `backend/streamer/consumers.py` の `@action` に合わせる。
- `consumers.py` の猶予削除の予約はプロセスごとに持つ。gunicorn が複数ワーカーだと再参加が
  別ワーカーに着くと cancel できないが、削除前に DB で生存ユーザーを確かめるので誤削除はしない。

```bash
docker compose up -d
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

LOADTEST_VUS=20 LOADTEST_ROOM_SIZE=5 LOADTEST_DURATION=2m docker compose ... run --rm k6

docker run --rm -v "$PWD/loadtest:/loadtest" -w /loadtest \
  grafana/k6:2.3.0 inspect /loadtest/scenarios/ws_party.js
```
