"use client";

import { useEffect, useState } from "react";
import { Pause, PictureInPicture2, Play, Radio } from "lucide-react";

import { openTimerPopup } from "@/components/timer/openTimerPopup";
import { WEBSOCKET_ENDPOINT } from "@/infrastructure/env";
import {
  TimerSpectatorClient,
  type TimerPlayback,
} from "@/infrastructure/ws/timerClient";

type Status = "connecting" | "live" | "ended" | "not-found";

/** 最後に受けた再生状態と、それを受けた時刻（`performance.now()`）。 */
type Anchor = TimerPlayback & { at: number };

// 秒表示なので 250ms 間隔で足りる。
const TICK_MS = 250;

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

/**
 * タイマー画面。`video_operation` を受けるたびに基準点（位置・再生中か・倍率・時刻）を
 * 更新し、`再生中 ? time + 経過 × rate : time` で表示する。ずれはホストの 5 秒ごとの
 * ハートビートで直る。
 */
export function TimerView({
  roomId,
  initialTitle,
  popup = false,
}: {
  roomId: string;
  /** ロビー解決 API の作品名。WS から届くまでの表示に使う。 */
  initialTitle: string;
  /** 別窓で開いたとき、全面を占める。 */
  popup?: boolean;
}): React.JSX.Element {
  const [status, setStatus] = useState<Status>("connecting");
  const [liveTitle, setLiveTitle] = useState("");
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const client = new TimerSpectatorClient(WEBSOCKET_ENDPOINT, roomId, {
      onAck: (title) => {
        setStatus("live");
        if (title) setLiveTitle(title);
      },
      onPlayback: (playback, title) => {
        setAnchor({ ...playback, at: performance.now() });
        setStatus("live");
        if (title) setLiveTitle(title);
      },
      onDisconnected: () => setStatus("connecting"),
      onEnded: (reason) =>
        setStatus(reason === "failed_spectate" ? "not-found" : "ended"),
    });
    client.connect();
    return () => client.close();
  }, [roomId]);

  const playing = anchor?.playing ?? false;

  useEffect(() => {
    if (!playing) return;
    const tick = window.setInterval(() => setNow(performance.now()), TICK_MS);
    return () => window.clearInterval(tick);
  }, [playing]);

  // now は基準点より古いことがある（受信直後・一時停止中）。そのときは経過 0 として扱う。
  const position =
    anchor === null
      ? null
      : anchor.playing
        ? anchor.time + (Math.max(0, now - anchor.at) / 1000) * anchor.rate
        : anchor.time;

  if (status === "not-found") {
    return (
      <Centered popup={popup}>
        <p className="text-lg font-medium">ルームが見つかりませんでした</p>
        <p className="text-muted-foreground">
          リンクが正しいか、ルームがまだ有効かをご確認ください。
        </p>
      </Centered>
    );
  }

  if (status === "ended") {
    return (
      <Centered popup={popup}>
        <p className="text-lg font-medium">配信が終了しました</p>
        <p className="text-muted-foreground">
          ホストがルームを退出または削除しました。
        </p>
      </Centered>
    );
  }

  return (
    <Centered popup={popup}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Radio
          className={
            status === "live"
              ? "size-4 text-primary"
              : "size-4 animate-pulse text-muted-foreground"
          }
          aria-hidden
        />
        {status === "live" ? "同期中" : "接続しています"}
      </div>

      <p className="max-w-xl text-balance text-lg font-medium">
        {liveTitle || initialTitle || "視聴中の作品"}
      </p>

      <div
        className="font-mono text-6xl font-bold tabular-nums tracking-tight"
        role="timer"
        aria-live="off"
      >
        {position === null ? "--:--" : formatTime(position)}
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {playing ? (
          <>
            <Play className="size-4 text-primary" aria-hidden /> 再生中
          </>
        ) : (
          <>
            <Pause className="size-4" aria-hidden /> 一時停止中
          </>
        )}
      </div>

      {anchor === null && (
        <p className="text-xs text-muted-foreground">
          ホストの操作を待っています…（最大 5 秒ほどで同期します）
        </p>
      )}

      {/* すでに別窓（ポップアップ）で開いているときは出さない。 */}
      {!popup && (
        <button
          type="button"
          onClick={() => openTimerPopup(roomId)}
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PictureInPicture2 className="size-4" aria-hidden />
          別窓（ポップアップ）で開く
        </button>
      )}
    </Centered>
  );
}

function Centered({
  children,
  popup = false,
}: {
  children: React.ReactNode;
  popup?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={
        popup
          ? // ポップアップ小窓では Header/Footer を覆って全面に表示する。
            "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-4 text-center"
          : "flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center"
      }
    >
      {children}
    </div>
  );
}
