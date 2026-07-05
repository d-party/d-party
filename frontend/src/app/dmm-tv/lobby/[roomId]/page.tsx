"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Download } from "lucide-react";

import {
  CHROME_WEBSTORE_URL,
  DMM_LOBBY_RESOLVE_ENDPOINT,
} from "@/infrastructure/env";

/**
 * DMM TV のルーム遷移ロビー。dアニメの `anime-store/lobby/[roomId]` と同じ
 * 拡張機能 DOM 契約（`.chrome_extension_field` に互換判定を書き込む）を使い、
 * 判定が "true" になったら DMM の再生ページへリダイレクトする。
 *
 *   - "true"  → `GET /api/v1/dmm-tv/lobby/{room_id}` が返す再生ページ URL
 *               （/vod/playback/on-demand/?season=..&content=..&party=join&room_id=..）へ遷移。
 *   - "false" → 拡張機能が非対応 → アップデート導線。
 *   - 30秒無応答 → 未インストール → インストール導線。
 *
 * NOTE: DMM のタイマー画面（拡張機能なしの観覧）は後続対応。ここでは拡張機能あり
 * のときの参加リダイレクトと、無い/非対応のときのインストール導線までを提供する。
 * 拡張機能側の content-version マッチに `dmm-tv/lobby/*` を追加する必要がある。
 */

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 29;
const NOTICE_FADE_MS = 2000;

type Phase = "checking" | "incompatible" | "uninstalled" | "not-found";

interface LobbyResolveResponse {
  redirect_url: string;
  part_id: string;
  room_id: string;
  title: string;
}

export default function DmmLobbyPage(): React.JSX.Element {
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

  const [phase, setPhase] = useState<Phase>("checking");
  const [loaderText, setLoaderText] = useState("ルームに接続しています");

  const redirectUrlRef = useRef<string | null>(null);
  const redirectPendingRef = useRef(false);

  // Resolve room_id → DMM 再生ページ URL via the backend.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${DMM_LOBBY_RESOLVE_ENDPOINT}${roomId}`);
        if (cancelled) return;
        if (res.ok) {
          const data = (await res.json()) as LobbyResolveResponse;
          redirectUrlRef.current = data.redirect_url;
          if (redirectPendingRef.current) {
            window.location.href = data.redirect_url;
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
  }, []);

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
                DMM TV で同時視聴するには d-party 拡張機能が必要です。
              </p>
            </div>
            <a
              href={CHROME_WEBSTORE_URL}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="size-4" aria-hidden />
              {phase === "incompatible"
                ? "アップデートする"
                : "インストールする"}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
