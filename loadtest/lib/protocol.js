// 送信メッセージの組み立てと、遅延計測用の時刻の埋め込み / 取り出し。
// backend は `{ "action", "request_id", ...引数 }` を要求する。

import { setTimeout, clearTimeout } from 'k6/timers';

let _seq = 0;
// k6 には crypto.randomUUID が無い。
export function requestId() {
  _seq += 1;
  return `${__VU}-${__ITER}-${_seq}-${Date.now()}`;
}

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

// 遅延計測用の ping。option は全項目が必須なので埋め、`src` に送信時刻を載せる。
// part_id はルームと同じにして、part_id の更新（DB 書き込み）を起こさない。
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

// ReactionType のメンバー名: cry / middle_finger / smile / thumbs_up / fav
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

// 無いルームには server_message(failed_spectate) が返る。
export function spectateMsg({ roomId }) {
  return {
    action: 'spectate',
    request_id: requestId(),
    room_id: roomId,
  };
}

// ホスト以外が送っても無視される。
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

// loadtest の ping なら送信時刻（ms）、それ以外は null。
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
