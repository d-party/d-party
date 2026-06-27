// d-party 同時視聴（WebSocket）負荷シナリオ。
//
// モデル: 1 VU = 1 ルーム。VU 内で host 1 接続 + guest (ROOM_SIZE-1) 接続を張り、
//   create → guest が join → 各参加者が video_operation(ping)/reaction を生成、
//   という実プロトコルの流れを再現する。VU 数 = 同時ルーム数、総接続数 = VUS × ROOM_SIZE。
//
// 計測の主眼はブロードキャスト増幅: 1 人の操作が group_send で N-1 接続へ配信される。
// ping の option.src に送信時刻を載せ、他参加者の受信時刻との差を broadcast_latency に記録する
// （送信元→daphne→Redis channel layer→他接続 の end-to-end 遅延）。
//
// 実行（リポジトリルートで、スタックを起動済みのこと）:
//   docker compose up -d
//   docker compose --profile loadtest run --rm k6
// 主なパラメータは環境変数（compose の k6 サービス参照）:
//   TARGET / ROOM_SIZE / VUS / DURATION / PING_INTERVAL_MS / REACTION_INTERVAL_MS

import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { setTimeout, clearTimeout } from 'k6/timers';
import { Participant } from '../lib/participant.js';
import { createMsg, joinMsg, videoPingMsg, reactionMsg, leaveMsg } from '../lib/protocol.js';

// ── パラメータ ────────────────────────────────────────────────────────────────
const TARGET = __ENV.TARGET || 'ws://nginx/anime-store/party/';
const ROOM_SIZE = Number(__ENV.ROOM_SIZE || 3); // 1 ルームあたりの参加者数（host 含む）
const VUS = Number(__ENV.VUS || 1); // 同時ルーム数
const DURATION = __ENV.DURATION || '30s';
const PING_INTERVAL_MS = Number(__ENV.PING_INTERVAL_MS || 1000);
const REACTION_INTERVAL_MS = Number(__ENV.REACTION_INTERVAL_MS || 1500);
const ROOM_LOAD_MS = Number(__ENV.ROOM_LOAD_MS || 8000); // 1 ルームの負荷フェーズ長
// 本番相当（DEBUG=0）では OriginValidator が D_ANIME_STORE_DOMAIN 由来 Origin のみ許可するため、
// 拡張機能と同じ Origin を付ける。dev（全 Origin 許可）では未指定で良い。
const ORIGIN = __ENV.ORIGIN || '';
const HEADERS = ORIGIN ? { Origin: ORIGIN } : null;
// part_id は AnimeRoom.part_id（varchar(16)）に保存されるため 16 文字以内に収める。
const PART_ID = __ENV.PART_ID || 'loadtest-0001';

// ── カスタムメトリクス ──────────────────────────────────────────────────────────
const metrics = {
  connectTime: new Trend('ws_connect_time', true),
  broadcastLatency: new Trend('broadcast_latency', true),
  broadcastReceived: new Counter('broadcast_received'),
  wsErrors: new Counter('ws_errors'),
};
const roomSetup = new Rate('room_setup_success'); // create+全員 join まで到達できた割合
const createTime = new Trend('create_time', true); // create 送信→room_id 受信
const joinTime = new Trend('join_time', true); // join 送信→join 確認受信

export const options = {
  scenarios: {
    party: {
      executor: 'constant-vus',
      vus: VUS,
      duration: DURATION,
    },
  },
  thresholds: {
    room_setup_success: ['rate>0.95'],
    ws_connect_time: ['p(95)<1000'],
    broadcast_latency: ['p(95)<500'],
    ws_errors: ['count<1'], // スモークでは 0 を期待。スケール時は緩める。
  },
};

// 一定間隔で fn を呼び続けるタイマー。stop() で止める。
function every(intervalMs, fn) {
  let timer;
  const tick = () => {
    fn();
    timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);
  return () => clearTimeout(timer);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runRoom() {
  const participants = [];
  const host = new Participant(TARGET, { name: `host-vu${__VU}`, metrics, headers: HEADERS });
  participants.push(host);

  try {
    // 1) host 接続 → create → room_id 取得
    await host.connect();
    const createdP = host.waitFor('create');
    const t0 = Date.now();
    host.send(createMsg({ partId: PART_ID, userName: `host-${__VU}` }));
    const created = await createdP;
    createTime.add(Date.now() - t0);
    const roomId = created.room_id;
    if (!roomId) throw new Error('create response had no room_id');

    // 2) guest を順次 join
    for (let i = 1; i < ROOM_SIZE; i += 1) {
      const guest = new Participant(TARGET, { name: `guest${i}-vu${__VU}`, metrics, headers: HEADERS });
      await guest.connect();
      const joinedP = guest.waitFor('join');
      const tj = Date.now();
      guest.send(joinMsg({ roomId, userName: `guest-${__VU}-${i}` }));
      await joinedP;
      joinTime.add(Date.now() - tj);
      participants.push(guest);
    }
    roomSetup.add(true);

    // 3) 負荷フェーズ: 各参加者が ping / 一部が reaction を生成
    const stops = [];
    participants.forEach((p, idx) => {
      stops.push(every(PING_INTERVAL_MS + idx * 50, () => p.send(videoPingMsg({ partId: PART_ID }))));
      if (idx % 2 === 0) {
        stops.push(every(REACTION_INTERVAL_MS + idx * 70, () => p.send(reactionMsg())));
      }
    });
    await delay(ROOM_LOAD_MS);
    stops.forEach((stop) => stop());

    // 4) 後片付け: host が抜けると room は grace 期間後に削除される
    host.send(leaveMsg());
    await delay(200);
  } catch (e) {
    roomSetup.add(false);
    metrics.wsErrors.add(1);
    // eslint-disable-next-line no-console
    console.error(`room failed (vu${__VU}): ${e.message}`);
  } finally {
    participants.forEach((p) => p.close());
  }
}

export default async function () {
  await runRoom();
  sleep(0.5); // ルーム再生成の間隔（thundering herd を避ける軽いジッタ）
}
