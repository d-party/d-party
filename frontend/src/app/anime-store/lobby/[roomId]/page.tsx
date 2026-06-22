"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

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
 *                new `GET /api/v1/anime-store/lobby/{room_id}` backend endpoint).
 *   - "false"  → extension too old → show notice, then redirect to the webstore.
 *   - 30s pass with neither verdict → extension not installed → webstore.
 */

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 29; // checks fire at t=1s..29s; gives a slow backend more time
// to write its verdict before we give up and assume the extension is missing.
const NOTICE_FADE_MS = 2000;
const WEBSTORE_REDIRECT_MS = 3000;

type Phase = "checking" | "incompatible" | "uninstalled" | "not-found";

export default function LobbyPage(): React.JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const [phase, setPhase] = useState<Phase>("checking");
  const [loaderText, setLoaderText] = useState("ルームに接続しています");

  // The resolved dアニメストア redirect URL; null until the backend responds.
  const redirectUrlRef = useRef<string | null>(null);
  // Set when the extension reported "true" before the URL had resolved.
  const redirectPendingRef = useRef(false);

  // Resolve room_id → dアニメストア redirect URL via the backend.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await lobbyResolve(roomId);
        if (cancelled) return;
        if (res.status === 200) {
          redirectUrlRef.current = res.data.redirect_url;
          // The extension may have already approved while we were waiting.
          if (redirectPendingRef.current) {
            window.location.href = res.data.redirect_url;
          }
        } else {
          setPhase("not-found");
        }
      } catch {
        if (!cancelled) setPhase("not-found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  // Poll the extension-written field and drive the redirect state machine.
  useEffect(() => {
    let polls = 0;
    let settled = false;

    const goWebstore = () =>
      window.setTimeout(() => {
        window.location.href = CHROME_WEBSTORE_URL;
      }, WEBSTORE_REDIRECT_MS);

    const readField = (): string | undefined => {
      const field = document.getElementsByClassName("chrome_extension_field")[0];
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
        window.setTimeout(() => {
          setPhase("incompatible");
          goWebstore();
        }, NOTICE_FADE_MS);
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
        window.setTimeout(() => {
          setPhase("uninstalled");
          goWebstore();
        }, NOTICE_FADE_MS);
      },
      POLL_INTERVAL_MS * (MAX_POLLS + 1),
    );

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(notInstalledTimer);
    };
  }, []);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      {/*
        Extension contract: the content-version script locates this element by
        class name and writes "true"/"false" into it. Must stay present and keep
        this exact class. Visually hidden but not display:none so innerText works.
      */}
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
            key="redirect-shop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center gap-3"
          >
            <Image src="/img/lobby/hand.svg" alt="" width={125} height={125} />
            <p className="text-lg font-medium">
              {phase === "incompatible"
                ? "拡張機能をアップデートしてください"
                : "拡張機能をインストールしてください"}
            </p>
            <p className="text-muted-foreground">
              3秒後にChrome ウェブストアにリダイレクトします
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
