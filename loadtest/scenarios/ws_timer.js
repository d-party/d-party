// タイマー。1 VU = 1 ルームで host だけが ping を送り、spectate の SPECTATORS 接続へ配信する。
// LOADTEST_SCENARIO=ws_timer.js で実行する。

import { sleep } from 'k6';
import { Rate } from 'k6/metrics';
import { Participant } from '../lib/participant.js';
import { createMsg, videoPingMsg, spectateMsg, leaveMsg } from '../lib/protocol.js';
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

// 観覧者数（host を除く）は ROOM_SIZE-1。
const SPECTATORS = Math.max(1, roomSize(4) - 1);

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

    // 4) 後片付け。
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
