// 3 つのシナリオが共有する設定（env）・メトリクス・タイマー。

import { Trend, Counter, Rate } from 'k6/metrics';
import { setTimeout, clearTimeout } from 'k6/timers';

export const TARGET = __ENV.TARGET || 'ws://nginx/anime-store/party/';
export const VUS = Number(__ENV.VUS || 1); // 同時ルーム数
export const DURATION = __ENV.DURATION || '30s';
export const PING_INTERVAL_MS = Number(__ENV.PING_INTERVAL_MS || 1000);
export const ROOM_LOAD_MS = Number(__ENV.ROOM_LOAD_MS || 8000); // 1 ルームの負荷フェーズ長
// DEBUG=0 では拡張機能と同じ Origin が要る。
const ORIGIN = __ENV.ORIGIN || '';
export const HEADERS = ORIGIN ? { Origin: ORIGIN } : null;
// AnimeRoom.part_id は varchar(16)。
export const PART_ID = __ENV.PART_ID || 'loadtest-0001';

// 1 ルームあたりの接続数（host 含む）。compose 経由では常に LOADTEST_ROOM_SIZE（既定 3）が
// 渡るので、fallback が効くのは k6 を直接走らせたときだけ。
export function roomSize(fallback) {
  return Number(__ENV.ROOM_SIZE || fallback);
}

// Participant へ注入するメトリクス。
export const metrics = {
  connectTime: new Trend('ws_connect_time', true),
  broadcastLatency: new Trend('broadcast_latency', true),
  broadcastReceived: new Counter('broadcast_received'),
  wsErrors: new Counter('ws_errors'),
};
// create から全員の参加まで到達できた割合。
export const roomSetup = new Rate('room_setup_success');

// 一定間隔で fn を呼び続ける。戻り値の関数で止める。
export function every(intervalMs, fn) {
  let timer;
  const tick = () => {
    fn();
    timer = setTimeout(tick, intervalMs);
  };
  timer = setTimeout(tick, intervalMs);
  return () => clearTimeout(timer);
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
