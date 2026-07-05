// d-party 一方通行(アクセラレーター)モードの WebSocket 負荷 + 挙動シナリオ。
//
// モデル: 1 VU = 1 ルーム。host が create → 詳細設定で一方通行モードを有効化 →
//   guest (ROOM_SIZE-1) が join。一方通行モードでは:
//     - host の video_operation は全 guest へブロードキャストされる（O(N) fanout）
//     - guest の video_operation はサーバでブロックされ、誰にも届かない
//   通常の ws_party.js が「全員が送信元」なのに対し、こちらは「送信元は host のみ」で
//   配信増幅の負荷プロファイルが異なる（配信者 1 + 視聴者多数の配信型ルーム）。
//
// 実行（リポジトリルートで、スタックを起動済みのこと）:
//   docker compose up -d
//   docker compose -f docker-compose.yml -f docker-compose.override.yml \
//     -f docker-compose.loadtest.yml --profile loadtest run --rm \
//     -e LOADTEST_SCENARIO=scenarios/ws_oneway.js k6
// （k6 サービスが実行スクリプトを LOADTEST_SCENARIO で切替可能な場合。既定は ws_party.js）

import { sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { setTimeout, clearTimeout } from 'k6/timers';
import { Participant } from '../lib/participant.js';
import {
  createMsg,
  joinMsg,
  videoPingMsg,
  updateSettingMsg,
  leaveMsg,
} from '../lib/protocol.js';

const TARGET = __ENV.TARGET || 'ws://nginx/anime-store/party/';
const ROOM_SIZE = Number(__ENV.ROOM_SIZE || 4); // host + (ROOM_SIZE-1) viewers
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
// 一方通行モードの強制が効いているか: guest の video_operation が host へ届かなければ true。
const oneWayEnforced = new Rate('one_way_enforced');
// host の操作は通常どおり guest へ届くか。
const hostBroadcastOk = new Rate('host_broadcast_ok');

export const options = {
  scenarios: {
    oneway: { executor: 'constant-vus', vus: VUS, duration: DURATION },
  },
  thresholds: {
    room_setup_success: ['rate>0.95'],
    one_way_enforced: ['rate>0.99'], // 非オーナー操作は必ずブロックされること
    host_broadcast_ok: ['rate>0.95'],
    ws_connect_time: ['p(95)<1000'],
    broadcast_latency: ['p(95)<500'],
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

// waitFor が指定時間内に解決したら true、タイムアウトしたら false を返す（例外にしない）。
async function received(participant, action, timeoutMs) {
  try {
    await participant.waitFor(action, timeoutMs);
    return true;
  } catch (_) {
    return false;
  }
}

async function runRoom() {
  const participants = [];
  const host = new Participant(TARGET, { name: `host-vu${__VU}`, metrics, headers: HEADERS });
  participants.push(host);

  try {
    // 1) host 接続 → create → 一方通行モードを有効化
    await host.connect();
    const createdP = host.waitFor('create');
    host.send(createMsg({ partId: PART_ID, userName: `host-${__VU}` }));
    const created = await createdP;
    const roomId = created.room_id;
    if (!roomId) throw new Error('create response had no room_id');
    host.send(updateSettingMsg({ oneWay: true }));

    // 2) viewer を順次 join
    for (let i = 1; i < ROOM_SIZE; i += 1) {
      const viewer = new Participant(TARGET, {
        name: `viewer${i}-vu${__VU}`,
        metrics,
        headers: HEADERS,
      });
      await viewer.connect();
      const joinedP = viewer.waitFor('join');
      viewer.send(joinMsg({ roomId, userName: `viewer-${__VU}-${i}` }));
      await joinedP;
      participants.push(viewer);
    }
    roomSetup.add(true);

    const viewers = participants.slice(1);

    // 3a) 挙動チェック: 非オーナー(viewer)の video_operation はブロックされる。
    const hostGotViewerOp = received(host, 'video_operation', 1200);
    viewers[0].send(videoPingMsg({ partId: PART_ID }));
    oneWayEnforced.add((await hostGotViewerOp) === false);

    // 3b) 挙動チェック: host の video_operation は viewer へ届く。
    const viewerGotHostOp = received(viewers[0], 'video_operation', 1200);
    host.send(videoPingMsg({ partId: PART_ID }));
    hostBroadcastOk.add(await viewerGotHostOp);

    // 4) 負荷フェーズ: host だけが定期 ping を送り、N-1 の viewer へ配信増幅する。
    const stop = every(PING_INTERVAL_MS, () => host.send(videoPingMsg({ partId: PART_ID })));
    await delay(ROOM_LOAD_MS);
    stop();

    // 5) 後片付け: 一方通行モード単体では host 退室でルームは自動削除されない
    //    （owner_leave_delete は含意しない）。host が抜けると viewer の 1 人が
    //    ホストへ昇格し、finally の close で全員が切断されるとルームが回収される。
    host.send(leaveMsg());
    await delay(200);
  } catch (e) {
    roomSetup.add(false);
    metrics.wsErrors.add(1);
    // eslint-disable-next-line no-console
    console.error(`oneway room failed (vu${__VU}): ${e.message}`);
  } finally {
    participants.forEach((p) => p.close());
  }
}

export default async function () {
  await runRoom();
  sleep(0.5);
}
