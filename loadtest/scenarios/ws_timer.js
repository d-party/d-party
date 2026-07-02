// d-party タイマー（観覧専用 / spectator）の WebSocket 負荷シナリオ。
//
// モデル: 1 VU = 1 ルーム。host が create し、以後 host だけが video_operation(ping) を
//   定期送信する。SPECTATORS 人の観覧専用接続が `spectate` で参加し、host の ping を
//   ブロードキャストで受信する。タイマーURL 機能（拡張機能なしのユーザーが再生状況だけを
//   見る）の負荷プロファイル = **配信者 1 + タイマー視聴者多数**。
//
// 観覧者は AnimeUser を作らないため人数・一覧・ホスト委譲・自動削除に影響しないが、
// group_send のファンアウト対象にはなる（1 操作 → SPECTATORS 接続へ配信）。ここでは
// その配信増幅（host ping → 各 spectator 受信）の end-to-end 遅延を測る。
//
// 実行（ルートでスタック起動後）:
//   LOADTEST_SCENARIO=ws_timer.js docker compose -f docker-compose.yml \
//     -f docker-compose.override.yml -f docker-compose.loadtest.yml \
//     --profile loadtest run --rm k6

import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { setTimeout, clearTimeout } from 'k6/timers';
import { Participant } from '../lib/participant.js';
import { createMsg, videoPingMsg, spectateMsg, leaveMsg } from '../lib/protocol.js';

const TARGET = __ENV.TARGET || 'ws://nginx/anime-store/party/';
// 観覧者数（host を除く）。既定は ROOM_SIZE-1 相当（ROOM_SIZE=一接続数の目安）。
const ROOM_SIZE = Number(__ENV.ROOM_SIZE || 4);
const SPECTATORS = Math.max(1, ROOM_SIZE - 1);
const VUS = Number(__ENV.VUS || 1);
const DURATION = __ENV.DURATION || '30s';
const PING_INTERVAL_MS = Number(__ENV.PING_INTERVAL_MS || 1000);
const ROOM_LOAD_MS = Number(__ENV.ROOM_LOAD_MS || 8000);
const ORIGIN = __ENV.ORIGIN || '';
const HEADERS = ORIGIN ? { Origin: ORIGIN } : null;
const PART_ID = __ENV.PART_ID || 'loadtest-0001';

const metrics = {
  connectTime: new Trend('ws_connect_time', true),
  broadcastLatency: new Trend('broadcast_latency', true),
  broadcastReceived: new Counter('broadcast_received'),
  wsErrors: new Counter('ws_errors'),
};
const roomSetup = new Rate('room_setup_success');
const spectateSuccess = new Rate('spectate_success'); // 全 spectator が spectate 受理された割合

export const options = {
  scenarios: {
    timer: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  thresholds: {
    room_setup_success: ['rate>0.95'],
    spectate_success: ['rate>0.95'],
    ws_connect_time: ['p(95)<1000'],
    broadcast_latency: ['p(95)<500'],
    ws_errors: ['count<1'],
  },
};

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
    // 1) host 接続 → create → room_id
    await host.connect();
    const createdP = host.waitFor('create');
    host.send(createMsg({ partId: PART_ID, userName: `host-${__VU}` }));
    const created = await createdP;
    const roomId = created.room_id;
    if (!roomId) throw new Error('create response had no room_id');

    // 2) 観覧専用（spectator）を順次 spectate
    for (let i = 0; i < SPECTATORS; i += 1) {
      const spec = new Participant(TARGET, {
        name: `spectator${i}-vu${__VU}`,
        metrics,
        headers: HEADERS,
      });
      await spec.connect();
      const ackP = spec.waitFor('spectate');
      spec.send(spectateMsg({ roomId }));
      const ack = await ackP;
      // spectate 受理応答は現在の part_id を返す（初期状態の受け渡し確認）。
      spectateSuccess.add(ack.part_id !== undefined);
      participants.push(spec);
    }
    roomSetup.add(true);

    // 3) 負荷フェーズ: host だけが ping を送り、SPECTATORS 接続へ配信増幅する。
    const stop = every(PING_INTERVAL_MS, () => host.send(videoPingMsg({ partId: PART_ID })));
    await delay(ROOM_LOAD_MS);
    stop();

    // 4) 後片付け: host が退室（観覧者は AnimeUser を持たないため grace 削除に影響しない）。
    host.send(leaveMsg());
    await delay(200);
  } catch (e) {
    roomSetup.add(false);
    metrics.wsErrors.add(1);
    // eslint-disable-next-line no-console
    console.error(`timer room failed (vu${__VU}): ${e.message}`);
  } finally {
    participants.forEach((p) => p.close());
  }
}

export default async function () {
  await runRoom();
  sleep(0.5);
}
