// 1 参加者 = 1 WebSocket 接続。k6 のイベント駆動の API を async/await で扱えるようにする。

import { WebSocket } from 'k6/websockets';
import { withTimeout, pingSentAt } from './protocol.js';

export class Participant {
  // metrics: { connectTime, broadcastLatency, broadcastReceived, wsErrors } を注入
  // headers: ハンドシェイクの追加ヘッダ（Origin など）

  constructor(url, { name, metrics, connectTimeoutMs = 5000, headers = null }) {
    this.url = url;
    this.name = name;
    this.metrics = metrics;
    this.connectTimeoutMs = connectTimeoutMs;
    this.headers = headers;
    this.ws = null;
    this.closed = false;
    // action 待ち受けの登録簿: action -> { resolve }
    this._waiters = new Map();
  }

  connect() {
    const started = Date.now();
    const params = this.headers ? { headers: this.headers } : undefined;
    const ws = new WebSocket(this.url, null, params);
    this.ws = ws;
    const opened = new Promise((resolve, reject) => {
      ws.addEventListener('open', () => {
        this.metrics.connectTime.add(Date.now() - started);
        resolve();
      });
      ws.addEventListener('error', (e) => {
        this.metrics.wsErrors.add(1);
        reject(new Error(`ws error (${this.name}): ${e && e.error ? e.error : 'unknown'}`));
      });
      ws.addEventListener('close', () => {
        this.closed = true;
      });
      ws.addEventListener('message', (e) => this._onMessage(e));
    });
    return withTimeout(opened, this.connectTimeoutMs, `connect(${this.name})`);
  }

  _onMessage(e) {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch (_) {
      return; // 解析できないフレームは無視
    }
    // 遅延計測: 他参加者が送った loadtest ping のブロードキャストを受信
    if (msg.action === 'video_operation') {
      const sentAt = pingSentAt(msg);
      if (sentAt !== null) {
        this.metrics.broadcastLatency.add(Date.now() - sentAt);
        this.metrics.broadcastReceived.add(1);
      }
    }
    // action 待ち受けの解決
    const waiter = this._waiters.get(msg.action);
    if (waiter) {
      this._waiters.delete(msg.action);
      waiter.resolve(msg);
    }
  }

  // 指定 action のメッセージを受け取るまで待つ（タイムアウト付き）。
  waitFor(action, timeoutMs = 5000) {
    const p = new Promise((resolve) => {
      this._waiters.set(action, { resolve });
    });
    return withTimeout(p, timeoutMs, `waitFor(${action}, ${this.name})`);
  }

  send(obj) {
    if (this.ws && !this.closed) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  close() {
    try {
      if (this.ws && !this.closed) this.ws.close();
    } catch (_) {
      /* noop */
    }
  }
}
