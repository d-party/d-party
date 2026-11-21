// 一方通行モード。1 VU = 1 ルームで、host だけが配信し、guest の操作はブロックされることも確かめる。
// LOADTEST_SCENARIO=ws_oneway.js で実行する。

import { sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { Participant } from '../lib/participant.js';
import {
  createMsg,
  joinMsg,
  videoPingMsg,
  updateSettingMsg,
  leaveMsg,
} from '../lib/protocol.js';
import {
  TARGET,
  VUS,
  DURATION,
  PING_INTERVAL_MS,
  ROOM_LOAD_MS,
  HEADERS,
  PART_ID,
  roomSize,
  metrics,
  roomSetup,
  every,
  delay,
} from '../lib/scenario.js';

const ROOM_SIZE = roomSize(4); // host + (ROOM_SIZE-1) viewers

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

    // 5) 後片付け。one_way だけではルームは消えない。全員が切れたら回収される。
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
