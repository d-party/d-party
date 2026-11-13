"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Download, PictureInPicture2 } from "lucide-react";

import { openTimerPopup } from "@/components/timer/openTimerPopup";
import { TimerView } from "@/components/timer/TimerView";
import { lobbyResolve } from "@/infrastructure/api/generated/d-party";
import { CHROME_WEBSTORE_URL } from "@/lib/links";

/**
 * The extension's `content-version` writes "true" / "false" into
 * `.chrome_extension_field`; we poll it every second.
 *   - "true"  → redirect to the dアニメストア player
 *   - "false" → offer the timer or an update
 *   - nothing for 30s → offer the timer or an install
 * `?timer=true` shows the timer instead.
 */

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 29;
const NOTICE_FADE_MS = 2000;

type Phase = "checking" | "incompatible" | "uninstalled" | "not-found";

export default function LobbyPage(): React.JSX.Element {
  // useSearchParams needs a Suspense boundary.
  return (
    <Suspense fallback={<LobbyFallback />}>
      <LobbyContent />
    </Suspense>
  );
}

function LobbyFallback(): React.JSX.Element {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <span
        className="size-12 animate-spin rounded-full border-4 border-muted border-t-primary"
        role="status"
        aria-label="読み込み中"
      />
    </div>
  );
}

function LobbyContent(): React.JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const searchParams = useSearchParams();
  const isTimer = searchParams.get("timer") === "true";
  const isPopup = searchParams.get("popup") === "1";

  const [phase, setPhase] = useState<Phase>("checking");
  const [loaderText, setLoaderText] = useState("ルームに接続しています");
  const [title, setTitle] = useState("");

  const redirectUrlRef = useRef<string | null>(null);
  const redirectPendingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await lobbyResolve(roomId);
        if (cancelled) return;
        if (res.status === 200) {
          setTitle(res.data.title ?? "");
          redirectUrlRef.current = res.data.redirect_url;
          if (isTimer) return;
          if (redirectPendingRef.current) {
            window.location.href = res.data.redirect_url;
          }
        } else if (!isTimer) {
          setPhase("not-found");
        }
      } catch {
        // タイマーはルームの有無を spectate で判定する。
        if (!cancelled && !isTimer) setPhase("not-found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, isTimer]);

  useEffect(() => {
    if (isTimer) return;

    let polls = 0;
    let settled = false;

    const readField = (): string | undefined => {
      const field = document.getElementsByClassName(
        "chrome_extension_field",
      )[0];
      return (field as HTMLElement | undefined)?.innerText?.trim();
    };

    const interval = window.setInterval(() => {
      polls += 1;
      const verdict = readField();

      if (verdict === "true") {
        settled = true;
        window.clearInterval(interval);
        if (redirectUrlRef.current) {
          window.location.href = redirectUrlRef.current;
        } else {
          redirectPendingRef.current = true;
          setLoaderText("ルーム情報を取得しています");
        }
        return;
      }

      if (verdict === "false") {
        settled = true;
        window.clearInterval(interval);
        setLoaderText("拡張機能のバージョンが対応していません");
        window.setTimeout(() => setPhase("incompatible"), NOTICE_FADE_MS);
        return;
      }

      if (polls >= MAX_POLLS) {
        window.clearInterval(interval);
      }
    }, POLL_INTERVAL_MS);

    const notInstalledTimer = window.setTimeout(
      () => {
        if (settled) return;
        window.clearInterval(interval);
        setLoaderText("拡張機能がインストールされていません");
        window.setTimeout(() => setPhase("uninstalled"), NOTICE_FADE_MS);
      },
      POLL_INTERVAL_MS * (MAX_POLLS + 1),
    );

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(notInstalledTimer);
    };
  }, [isTimer]);

  if (isTimer) {
    return <TimerView roomId={roomId} initialTitle={title} popup={isPopup} />;
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      {/* 拡張機能との契約。クラス名を変えない。display:none だと innerText が使えない。 */}

      <div className="chrome_extension_field sr-only" aria-hidden />

      <AnimatePresence mode="wait">
        {phase === "checking" ? (
          <motion.div
            key="checking"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-4"
          >
            <span
              className="size-12 animate-spin rounded-full border-4 border-muted border-t-primary"
              role="status"
              aria-label="読み込み中"
            />
            <p className="text-lg text-muted-foreground">{loaderText}</p>
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
                {phase === "incompatible"
                  ? "拡張機能が最新ではありません"
                  : "拡張機能が見つかりませんでした"}
              </p>
              <p className="text-muted-foreground">
                拡張機能なしでも、タイマーで再生状況を見られます。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={`/anime-store/lobby/${roomId}?timer=true`}
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
                {phase === "incompatible"
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
