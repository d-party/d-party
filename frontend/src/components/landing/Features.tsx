"use client";

import { motion, type Variants } from "framer-motion";
import {
  Gift,
  RefreshCw,
  ShieldCheck,
  Smile,
  SquareArrowOutUpRight,
  Zap,
  type LucideIcon,
} from "lucide-react";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const FEATURES: Feature[] = [
  {
    icon: RefreshCw,
    title: "再生を自動シンク",
    description:
      "ルーム参加者の再生・一時停止・シークを自動で同期。「せーの」の掛け声はもう必要ありません。",
  },
  {
    icon: Smile,
    title: "リアクション",
    description:
      "視聴しながらリアクションを送り合って、離れていても同じ部屋にいるみたいに盛り上がれます。",
  },
  {
    icon: ShieldCheck,
    title: "安全なルームリンク",
    description:
      "招待リンクは完全にランダム生成。ルームから人がいなくなれば自動で失効し、第三者は参加できません。",
  },
  {
    icon: Gift,
    title: "完全無料・広告なし",
    description:
      "料金も広告も一切なし。dアニメストアや DMM TV を利用していれば、追加コストゼロで使えます。",
  },
  {
    icon: Zap,
    title: "自動アップデート",
    description:
      "インストールはすぐ完了し、再起動も不要。アップデートも自動なので常に最新の状態です。",
  },
  {
    icon: SquareArrowOutUpRight,
    title: "便利機能つき",
    description:
      "「別タブで動画を開く」など、dアニメストアをちょっと快適に使える機能も入っています。",
  },
];

const grid: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const card: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export function Features(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-5xl px-4 pb-16 pt-4">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-bold tracking-tight">
          dアニメストアを同時視聴で、もっと楽しく
        </h2>
        <p className="mt-3 text-muted-foreground">
          d-partyは次のような機能を提供しています。
        </p>
      </div>

      <motion.ul
        variants={grid}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <motion.li
            key={title}
            variants={card}
            className="group rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
          >
            <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
              <Icon className="size-5" aria-hidden />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
