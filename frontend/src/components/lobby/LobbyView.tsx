"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Download, PictureInPicture2 } from "lucide-react";

import { openTimerPopup } from "@/components/timer/openTimerPopup";
import { TimerView } from "@/components/timer/TimerView";
import { lobbyResolve } from "@/infrastructure/api/generated/d-party";
import { CHROME_WEBSTORE_URL, timerPath } from "@/lib/links";

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 30;
const NOTICE_FADE_MS = 2000;

/** What `.chrome_extension_field` said: "true" / "false" / nothing for 30s. */
type Extension = "pending" | "supported" | "outdated" | "missing";

type Room =
  | { status: "loading" }
  | { status: "found"; redirectUrl: string; title: string }
  | { status: "missing" };

const LOADER_TEXT: Record<Extension, string> = {
  pending: "ルームに接続しています",
  // ルーム情報の到着を待っている間だけ出る。届いていればすぐ移動する。
  supported: "ルーム情報を取得しています",
  outdated: "拡張機能のバージョンが対応していません",
  missing: "拡張機能がインストールされていません",
};

export function LobbySpinner(): React.JSX.Element {
  return (
    <span
      className="size-12 animate-spin rounded-full border-4 border-muted border-t-primary"
      role="status"
      aria-label="読み込み中"
    />
  );
}

/**
 * The extension's `content-version` writes "true" / "false" into
 * `.chrome_extension_field`; we poll it every second.
 *   - "true"  → redirect to the dアニメストア player
 *   - "false" → offer the timer or an update
 *   - nothing for 30s → offer the timer or an install
 * `?timer=true` shows the timer instead.
 */
export function LobbyView({ roomId }: { roomId: string }): React.JSX.Element {
  const searchParams = useSearchParams();
  const isTimer = searchParams.get("timer") === "true";
  const isPopup = searchParams.get("popup") === "1";

  const [room, setRoom] = useState<Room>({ status: "loading" });
  const [extension, setExtension] = useState<Extension>("pending");
  // 判定の文言をしばらく見せてから選択肢に切り替える。
  const [noticeShown, setNoticeShown] = useState(false);

  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    lobbyResolve(roomId)
      .then(
        (res): Room =>
          res.status === 200
            ? {
                status: "found",
                redirectUrl: res.data.redirect_url,
                title: res.data.title,
              }
            : { status: "missing" },
      )
      .catch((): Room => ({ status: "missing" }))
      .then((next) => {
        if (!cancelled) setRoom(next);
      });
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    if (isTimer) return;

    let polls = 0;
    const interval = window.setInterval(() => {
      polls += 1;
      const verdict = fieldRef.current?.innerText.trim();
      if (verdict === "true") setExtension("supported");
      else if (verdict === "false") setExtension("outdated");
      else if (polls >= MAX_POLLS) setExtension("missing");
      else return;
      window.clearInterval(interval);
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isTimer]);

  const redirectUrl =
    !isTimer && extension === "supported" && room.status === "found"
      ? room.redirectUrl
      : null;

  useEffect(() => {
    if (redirectUrl) window.location.href = redirectUrl;
  }, [redirectUrl]);

  const unusable = extension === "outdated" || extension === "missing";

  useEffect(() => {
    if (!unusable) return;
    const timer = window.setTimeout(() => setNoticeShown(true), NOTICE_FADE_MS);
    return () => window.clearTimeout(timer);
  }, [unusable]);

  if (isTimer) {
    // タイマーはルームの有無を spectate で判定する。
    return (
      <TimerView
        roomId={roomId}
        initialTitle={room.status === "found" ? room.title : ""}
        popup={isPopup}
      />
    );
  }

  const phase =
    room.status === "missing"
      ? "not-found"
      : unusable && noticeShown
        ? "choose"
        : "checking";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      {/*
        拡張機能との契約。クラス名を変えない。display:none だと innerText が使えない。
        中身は拡張機能のもの。hydrate より先に書かれても React が消さないよう、
        子を持たない innerHTML として扱わせる。
      */}
      <div
        ref={fieldRef}
        className="chrome_extension_field sr-only"
        aria-hidden
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: "" }}
      />

      <AnimatePresence mode="wait">
        {phase === "checking" ? (
          <motion.div
            key="checking"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-4"
          >
            <LobbySpinner />
            <p className="text-lg text-muted-foreground">
              {redirectUrl ? LOADER_TEXT.pending : LOADER_TEXT[extension]}
            </p>
          </motion.div>
        ) : phase === "not-found" ? (
          <motion.div
            key="not-found"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <Image src="/img/lobby/hand.svg" alt="" width={125} height={125} />
            <p className="text-lg font-medium">ルームが見つかりませんでした</p>
            <p className="text-muted-foreground">
              リンクが正しいか、ルームがまだ有効かをご確認ください。
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="choose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-5"
          >
            <Image src="/img/lobby/hand.svg" alt="" width={125} height={125} />
            <div className="flex flex-col gap-1.5">
              <p className="text-lg font-medium">
                {extension === "outdated"
                  ? "拡張機能が最新ではありません"
                  : "拡張機能が見つかりませんでした"}
              </p>
              <p className="text-muted-foreground">
                拡張機能なしでも、タイマーで再生状況を見られます。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={timerPath(roomId)}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Clock className="size-4" aria-hidden /> タイマーを見る
              </a>
              <button
                type="button"
                onClick={() => openTimerPopup(roomId)}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
              >
                <PictureInPicture2 className="size-4" aria-hidden />
                ポップアップで開く
              </button>
              <a
                href={CHROME_WEBSTORE_URL}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted"
              >
                <Download className="size-4" aria-hidden />
                {extension === "outdated"
                  ? "アップデートする"
                  : "インストールする"}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
