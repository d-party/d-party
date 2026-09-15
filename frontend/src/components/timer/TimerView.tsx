"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, PictureInPicture2, Play, Radio } from "lucide-react";

import { openTimerPopup } from "@/components/timer/openTimerPopup";
import {
  TimerSpectatorClient,
  type TimerSyncOption,
} from "@/infrastructure/ws/timerClient";
import { WEBSOCKET_ENDPOINT } from "@/infrastructure/env";

/**
 * タイマー画面（拡張機能なし・dアニメストア不要）。
 *
 * ルームへ観覧専用（spectator）で接続し、既存の `video_operation` ブロードキャストを受信して
 * **再生位置を計算で再現**する。受信のたびに「基準点（anchor）」= その時点の再生位置・再生中か・
 * 倍率・受信時刻 を更新し、表示値は `再生中 ? time + 経過 × rate : time` で外挿する。ホストの
 * 5 秒ごとのハートビートでドリフトが補正される。追加の WS 通信は行わない。
 */

type Status = "connecting" | "live" | "reconnecting" | "ended" | "not-found";

interface Anchor {
  time: number;
  playing: boolean;
  rate: number;
  at: number; // performance.now() at receipt
}

function computeCurrent(anchor: Anchor): number {
  if (!anchor.playing) return anchor.time;
  const elapsed = (performance.now() - anchor.at) / 1000;
  return anchor.time + elapsed * anchor.rate;
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

export function TimerView({
  roomId,
  initialTitle,
  popup = false,
}: {
  roomId: string;
  initialTitle: string;
  /** 小さな別窓（ポップアップ）で開いた場合は全面を占める簡素なレイアウトにする。 */
  popup?: boolean;
}): React.JSX.Element {
  const [status, setStatus] = useState<Status>("connecting");
  const [title, setTitle] = useState(initialTitle);
  const [playing, setPlaying] = useState(false);
  const [display, setDisplay] = useState(0);
  // 直近に受信した再生状態を受け取ったか（未受信なら「まだ操作がありません」を出す）。
  const [hasState, setHasState] = useState(false);

  const anchorRef = useRef<Anchor | null>(null);

  useEffect(() => {
    const client = new TimerSpectatorClient(WEBSOCKET_ENDPOINT, roomId, {
      onOpen: () => setStatus((s) => (s === "reconnecting" ? "live" : s)),
      onAck: (_partId, ackTitle) => {
        setStatus("live");
        if (ackTitle) setTitle(ackTitle);
      },
      onVideoOperation: (option: TimerSyncOption, opTitle?: string) => {
        anchorRef.current = {
          time: Number(option.time) || 0,
          // pydantic は paused を "True" / "False" の文字列で送る。
          playing: String(option.paused) === "False",
          rate: Number(option.rate) || 1,
          at: performance.now(),
        };
        setPlaying(anchorRef.current.playing);
        setHasState(true);
        setStatus("live");
        if (opTitle) setTitle(opTitle);
      },
      onEnded: (reason) => {
        if (reason === "failed_spectate") setStatus("not-found");
        else setStatus("ended");
      },
    });
    client.connect();

    // 計算で再生位置を進める（seconds 表示なので 250ms 間隔で十分）。
    const tick = window.setInterval(() => {
      if (anchorRef.current) setDisplay(computeCurrent(anchorRef.current));
    }, 250);

    return () => {
      window.clearInterval(tick);
      client.close();
    };
  }, [roomId]);

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
        {title || "視聴中の作品"}
      </p>

      <div
        className="font-mono text-6xl font-bold tabular-nums tracking-tight"
        role="timer"
        aria-live="off"
      >
        {hasState ? formatTime(display) : "--:--"}
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

      {!hasState && (
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
