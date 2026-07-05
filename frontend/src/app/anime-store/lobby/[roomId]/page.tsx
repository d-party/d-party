"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, Download, PictureInPicture2 } from "lucide-react";

import { openTimerPopup } from "@/components/timer/openTimerPopup";
import { TimerView } from "@/components/timer/TimerView";
import { lobbyResolve } from "@/infrastructure/api/generated/d-party";
import { CHROME_WEBSTORE_URL } from "@/infrastructure/env";

/**
 * Room-transition lobby — faithful port of web/templates/lobby_redirect.html.
 *
 * The Chrome extension's `content-version` script matches
 * `https://d-party.net/anime-store/lobby/*` and writes the backend's version
 * compatibility verdict ("true" / "false") into the `.chrome_extension_field`
 * element below. We poll that element once per second:
 *   - "true"   → redirect to the dアニメストア player URL (resolved from the
 *                `GET /api/v1/anime-store/lobby/{room_id}` backend endpoint).
 *   - "false"  → extension too old → offer "view timer" or "update".
 *   - 30s pass with neither verdict → extension not installed → offer
 *                "view timer" or "install".
 *
 * タイマー機能: 拡張機能なし・dアニメストア不要のユーザー向けに、`?timer=true` を付けた
 * 同じロビー URL で「タイマー画面」を表示する（新規 URL は発行しない）。拡張機能が無い/
 * 非対応のときは、従来のウェブストア自動遷移に代えて「タイマーを見る or インストール/
 * アップデート」の選択を提示する。
 */

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 29; // checks fire at t=1s..29s; gives a slow backend more time
// to write its verdict before we give up and assume the extension is missing.
const NOTICE_FADE_MS = 2000;

type Phase = "checking" | "incompatible" | "uninstalled" | "not-found";

export default function LobbyPage(): React.JSX.Element {
  // useSearchParams は Suspense 境界を要求する（Next のビルド要件）。
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
  // ポップアップ小窓で開いたタイマー（Header/Footer を覆う全面表示にする）。
  const isPopup = searchParams.get("popup") === "1";

  const [phase, setPhase] = useState<Phase>("checking");
  const [loaderText, setLoaderText] = useState("ルームに接続しています");
  // タイマー画面の初期タイトル（lobbyResolve から。以後は WS の video_operation で更新）。
  const [title, setTitle] = useState("");

  // The resolved dアニメストア redirect URL; null until the backend responds.
  const redirectUrlRef = useRef<string | null>(null);
  // Set when the extension reported "true" before the URL had resolved.
  const redirectPendingRef = useRef(false);

  // Resolve room_id → dアニメストア redirect URL (and capture the title) via the backend.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await lobbyResolve(roomId);
        if (cancelled) return;
        if (res.status === 200) {
          setTitle(res.data.title ?? "");
          redirectUrlRef.current = res.data.redirect_url;
          // タイマー表示のときはリダイレクトしない（タイトル取得のみ）。
          if (isTimer) return;
          // The extension may have already approved while we were waiting.
          if (redirectPendingRef.current) {
            window.location.href = res.data.redirect_url;
          }
        } else if (!isTimer) {
          setPhase("not-found");
        }
      } catch {
        // タイマー表示ではルームの有無を WS(spectate) 側で判定するため無視。
        if (!cancelled && !isTimer) setPhase("not-found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, isTimer]);

  // Poll the extension-written field and drive the redirect state machine.
  useEffect(() => {
    // タイマー表示では拡張機能の検出・遷移を行わない。
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
          // URL not resolved yet — redirect as soon as the fetch completes.
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

    // After 30s with no verdict, treat the extension as not installed.
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

  // タイマー表示: 拡張機能の検出をスキップして再生状況を表示する。
  if (isTimer) {
    return <TimerView roomId={roomId} initialTitle={title} popup={isPopup} />;
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      {/*
        Extension contract: the content-version script locates this element by
        class name and writes "true"/"false" into it. Must stay present and keep
        this exact class. Visually hidden but not display:none so innerText works.
      */}
      <div
        className="chrome_extension_field sr-only"
        aria-hidden
        suppressHydrationWarning
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
