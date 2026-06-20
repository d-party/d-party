"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { CHROME_WEBSTORE_URL } from "@/infrastructure/env";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const BADGES = ["完全無料", "広告なし", "自動同期", "インストール即利用"];

export function Hero(): React.JSX.Element {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Decorative, low-key brand glow — purely graphical, behind content. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-[-6rem] size-[28rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute right-[-8rem] top-32 size-[22rem] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:py-28"
      >
        {/* Framed logo "app icon" enclosure. */}
        <motion.div variants={item}>
          <motion.div
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={
              reduce
                ? undefined
                : { duration: 5, repeat: Infinity, ease: "easeInOut" }
            }
            className="flex size-28 items-center justify-center rounded-3xl border border-border bg-card/70 shadow-xl shadow-primary/10 ring-1 ring-primary/20 backdrop-blur sm:size-32"
          >
            <Logo className="size-16 sm:size-20" />
          </motion.div>
        </motion.div>

        <motion.h1
          variants={item}
          className="mt-8 bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl"
        >
          d-party
        </motion.h1>

        <motion.p
          variants={item}
          className="mt-4 max-w-2xl text-lg text-muted-foreground sm:text-xl"
        >
          dアニメストアでも、離れた友達とウォッチパーティー。
          <br className="hidden sm:block" />
          再生も一時停止もシークも自動でシンクする、完全無料の Chrome 拡張機能。
        </motion.p>

        <motion.ul
          variants={item}
          className="mt-6 flex flex-wrap justify-center gap-2"
        >
          {BADGES.map((b) => (
            <li
              key={b}
              className="rounded-full border border-border bg-card/60 px-3 py-1 text-sm text-muted-foreground"
            >
              {b}
            </li>
          ))}
        </motion.ul>

        <motion.div
          variants={item}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="h-12 px-8 text-base">
            <a
              href={CHROME_WEBSTORE_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              <Download />
              今すぐインストール
            </a>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 px-8 text-base"
          >
            <Link href="/usage">
              使い方を見る
              <ArrowRight />
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  );
}
