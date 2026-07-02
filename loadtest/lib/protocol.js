// d-party WebSocket 同時視聴プロトコルのヘルパ。
//
// backend は djangochannelsrestframework の `@action()` ベースで、受信メッセージは
//   { "action": "<name>", "request_id": "<id>", ...引数 }
// というエンベロープを要求する（`action` / `request_id` が無いと dispatch でエラー）。
// 対応する consumer / format は backend/streamer/{consumers,format}.py を参照。
//
// このファイルは「送信メッセージの組み立て」と「遅延計測用タイムスタンプの埋め込み /
// 取り出し」だけを担う薄いユーティリティ。WS の張り方やシナリオは scenarios/ 側。

import { setTimeout, clearTimeout } from 'k6/timers';

let _seq = 0;
// k6 は crypto.randomUUID を持たないため、VU/iteration/連番で衝突しない request_id を作る。
export function requestId() {
  _seq += 1;
  return `${__VU}-${__ITER}-${_seq}-${Date.now()}`;
}

// ── 送信メッセージ組み立て（consumer の @action 引数に対応）─────────────────────
export function createMsg({ partId, userName, title = '', userIcon = 'FaRegUser' }) {
  return {
    action: 'create',
    request_id: requestId(),
    part_id: partId,
    user_name: userName,
    title,
    user_icon: userIcon,
  };
}

export function joinMsg({ roomId, userName, userIcon = 'FaRegUser' }) {
  return {
    action: 'join',
    request_id: requestId(),
    room_id: roomId,
    user_name: userName,
    user_icon: userIcon,
  };
}

// 遅延計測用の "ping"。video_operation の option はサーバ側で Option モデル
// （time/src/paused/rate/part_id がいずれも必須）に validate されるため、全項目を
// 埋める。自由文字列の `src` に送信時刻マーカーを載せて受信側で取り出す。
// part_id は room と同一に保ち、余計な part_id 更新（DB 書き込み）を誘発しない。
const PING_PREFIX = 'LT:';
export function videoPingMsg({ partId }) {
  return {
    action: 'video_operation',
    request_id: requestId(),
    operation: 'loadtest_ping',
    option: {
      time: 0,
      src: `${PING_PREFIX}${Date.now()}`,
      paused: 'true',
      rate: '1',
      part_id: partId,
    },
  };
}

// reaction_type は ReactionType（TextChoices）の「メンバー名」である必要がある:
// cry / middle_finger / smile / thumbs_up / fav（サーバは ReactionType[name] で引く）。
export function reactionMsg(reactionType = 'smile') {
  return {
    action: 'reaction',
    request_id: requestId(),
    reaction_type: reactionType,
  };
}

export function leaveMsg() {
  return { action: 'leave', request_id: requestId() };
}

// ルーム詳細設定の更新（オーナー限定。バックエンドはホスト以外の update_setting を無視する）。
// 一方通行(アクセラレーター)モードでは非オーナーの video_operation がブロードキャストされない。
export function updateSettingMsg({
  oneWay = false,
  ownerLeaveDelete = false,
  disableReaction = false,
} = {}) {
  return {
    action: 'update_setting',
    request_id: requestId(),
    one_way: oneWay,
    owner_leave_delete: ownerLeaveDelete,
    disable_reaction: disableReaction,
  };
}

// 受信した video_operation ブロードキャストが loadtest ping なら、送信時刻(ms)を返す。
// それ以外（実プレイヤー操作の形）なら null。
export function pingSentAt(msg) {
  const src = msg && msg.option && msg.option.src;
  if (typeof src === 'string' && src.startsWith(PING_PREFIX)) {
    const ts = Number(src.slice(PING_PREFIX.length));
    return Number.isFinite(ts) ? ts : null;
  }
  return null;
}

// Promise を timeout 付きにする。指定 ms 以内に解決しなければ reject。
export function withTimeout(promise, ms, label = 'operation') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
