# loadtest — d-party 負荷試験（k6 / WebSocket 同時視聴）

dアニメストア同時視聴サービスの **WebSocket（Channels）同期** を主対象とした負荷試験。
スタック全体（nginx → django(daphne) → Redis channel layer / PostgreSQL）を、本番に近い経路で叩く。

> サブモジュール規約により、この負荷試験は `backend/` ではなく**ルートリポジトリ**に置く
> （オーケストレーション層の関心事のため）。詳細は [`../AGENTS.md`](../AGENTS.md)。

## 何を測るか

このサービスの負荷の本質は **ブロードキャスト増幅**: 1 ルームに N 人いると、誰か 1 人の
`video_operation` / `reaction` が `group_send` で N-1 接続へ配信される（O(N) ファンアウト）。
単発 RPS ではなく「多接続の常時接続下でブロードキャストが捌けるか」が主眼。

- **モデル**: 1 VU = 1 ルーム。VU 内で host 1 + guest (`ROOM_SIZE`-1) を張る。
  同時ルーム数 = `VUS`、総接続数 = `VUS × ROOM_SIZE`。
- **シナリオ**: `create` → guest が `join` → 各参加者が `video_operation`(ping)/`reaction` を生成 → `leave`。
  プロトコルは [`backend/streamer/consumers.py`](../backend/streamer/consumers.py) の `@action` に対応。

## 主なメトリクス / しきい値

| メトリクス | 意味 |
| --- | --- |
| `broadcast_latency` | 操作送信→他参加者受信の end-to-end 遅延（ping の `option.src` に送信時刻を埋めて実測） |
| `ws_connect_time` | WS 接続確立時間 |
| `create_time` / `join_time` | ルーム作成 / 参加の応答時間 |
| `room_setup_success` | create＋全員 join まで到達できた割合 |
| `broadcast_received` | 受信したブロードキャスト ping の総数 |
| `ws_errors` | 接続/プロトコルエラー数 |

しきい値は [`scenarios/ws_party.js`](scenarios/ws_party.js) の `options.thresholds`。スケール試験では緩める。

## 使い方

```bash
# リポジトリルートで。まずスタックを起動（dev 既定）
docker compose up -d

# スモーク（1 ルーム×3 人、30s）
docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6

# スケール例（20 ルーム×5 人 = 100 接続、2 分）
LOADTEST_VUS=20 LOADTEST_ROOM_SIZE=5 LOADTEST_DURATION=2m \
  docker compose -f docker-compose.yml -f docker-compose.override.yml \
  -f docker-compose.loadtest.yml --profile loadtest run --rm k6
```

サマリは `loadtest/results/summary.json` に出力される（`results/` は gitignore）。

### パラメータ（`LOADTEST_*` env）

| env | 既定 | 意味 |
| --- | --- | --- |
| `LOADTEST_TARGET` | `ws://nginx/anime-store/party/` | 接続先。nginx を介さず叩くなら `ws://django:8000/anime-store/party/` |
| `LOADTEST_VUS` | `1` | 同時ルーム数 |
| `LOADTEST_ROOM_SIZE` | `3` | 1 ルームの参加者数（host 含む） |
| `LOADTEST_DURATION` | `30s` | 試験全体の長さ |
| `LOADTEST_PING_INTERVAL_MS` | `1000` | 各参加者の video_operation 間隔 |
| `LOADTEST_REACTION_INTERVAL_MS` | `1500` | reaction 間隔 |
| `LOADTEST_ROOM_LOAD_MS` | `8000` | 1 ルームの負荷フェーズ長 |

## Grafana / Prometheus 連携（任意）

既存の `metrics` profile（prometheus + grafana）に流して、負荷側メトリクスと
django-prometheus / cadvisor / node-exporter のサーバ側メトリクスを同一時間軸で突き合わせられる。

1. prometheus の起動コマンドに `--web.enable-remote-write-receiver` を追加（remote-write 受信を有効化）。
2. k6 サービスの environment に以下を設定（[`../docker-compose.loadtest.yml`](../docker-compose.loadtest.yml) のコメント参照）:
   - `K6_OUT=experimental-prometheus-rw`
   - `K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write`
3. Grafana に k6 公式ダッシュボード（Prometheus データソース）を追加。

## 既知の注意点（コードベース由来）

- `consumers.py` の `_pending_room_deletes` は **プロセス内 dict + asyncio.Task で「単一 daphne ワーカー前提」**。
  マルチワーカー / 水平スケール下では grace 削除やルーム整合が壊れうる。スケール試験で要確認。
- 既定 `TARGET` は nginx 経由のため、`docker compose up -d` で nginx が healthy になっている必要がある
  （nginx は frontend の healthy を待つ。frontend を避けたい場合は `TARGET` を django 直叩きにする）。
- `OriginValidator` は dev（`DEBUG=1`）では全 Origin 許可。本番相当の検証時は `D_ANIME_STORE_DOMAIN` の
  Origin ヘッダ付与が必要になる点に注意。
