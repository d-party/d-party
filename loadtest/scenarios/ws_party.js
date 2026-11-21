// 既定シナリオ。1 VU = 1 ルーム（host 1 + guest ROOM_SIZE-1）で、全員が ping と reaction を送る。
// ping の送信時刻と他の参加者の受信時刻の差を broadcast_latency に記録する。

import { sleep } from 'k6';
import { Trend } from 'k6/metrics';
import { Participant } from '../lib/participant.js';
import { createMsg, joinMsg, videoPingMsg, reactionMsg, leaveMsg } from '../lib/protocol.js';
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

const ROOM_SIZE = roomSize(3);
const REACTION_INTERVAL_MS = Number(__ENV.REACTION_INTERVAL_MS || 1500);

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
