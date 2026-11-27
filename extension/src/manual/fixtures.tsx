/**
 * 利用マニュアル（frontend /docs）のスクリーンショット撮影用の架空データと絵。
 * 実在の作品・人物・サービスの画像は使わない。
 */
import type { Announcement } from "@/domain/announcement";
import type { User } from "@/domain/protocol";

export const ROOM_ID = "7c3e9a52-4b1d-4f86-9a2e-5d0c81f3b6a4";
export const SHARE_URL = `https://d-party.net/anime-store/lobby/${ROOM_ID}`;
export const WORK_TITLE = "星降る町の喫茶店";
export const EPISODE_NO = "第3話";
export const EPISODE_SUB = "流れ星のブレンド";
export const SHARE_TITLE = `${WORK_TITLE} - ${EPISODE_NO} - ${EPISODE_SUB}`;
export const EPISODE_LENGTH = "23:40";

export const SAKURA: User = {
  user_id: "u-sakura",
  user_name: "さくら",
  user_icon: "FaCat",
  is_host: true,
};
export const TAKESHI: User = {
  user_id: "u-takeshi",
  user_name: "たけし",
  user_icon: "FaDog",
};
export const YUUKI: User = {
  user_id: "u-yuuki",
  user_name: "ゆうき",
  user_icon: "FaGamepad",
};
export const USERS: User[] = [SAKURA, TAKESHI, YUUKI];

/**
 * 運営からのアナウンス（架空）。撮影日 2026-11-27（金）の翌週のメンテナンス予告と、
 * このマニュアルの公開のお知らせ。本文は backend の上限（60 文字）に収める。
 * `MANUAL_ANNOUNCEMENTS` は backend の並び（開始が新しい順）で、画面に出るのは先頭の 1 件。
 */
export const MAINTENANCE_NOTICE: Announcement = {
  id: 101,
  level: "warning",
  message: "12月3日（木）2:00〜6:00 はメンテナンスのため同時視聴を利用できません",
};
export const MANUAL_NOTICE: Announcement = {
  id: 102,
  level: "info",
  message: "利用マニュアルを公開しました。「情報」タブの「使い方」から開けます",
};
export const MANUAL_ANNOUNCEMENTS: Announcement[] = [MAINTENANCE_NOTICE, MANUAL_NOTICE];

/** `announcements` をすぐ返す `load`（何も渡さなければアナウンスなし）。 */
export function announcementsOf(
  ...announcements: Announcement[]
): () => Promise<Announcement[]> {
  return () => Promise.resolve(announcements);
}

/** `formatTime()`（履歴の時刻）を決まった時刻で呼ぶ。 */
export function atClock<T>(iso: string, fn: () => T): T {
  const RealDate = Date;
  const fixed = new RealDate(iso).getTime();
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      else super(...(args as [string | number]));
    }
    static override now(): number {
      return fixed;
    }
  }
  globalThis.Date = FixedDate as DateConstructor;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** 架空のアニメ「星降る町の喫茶店」の一場面（夜空・流れ星・丘の上の喫茶店）。 */
export function NightCafeArt({
  variant = 0,
  className,
}: {
  variant?: number;
  className?: string;
}): React.JSX.Element {
  const rand = seeded(7 + variant * 31);
  const stars = Array.from({ length: 90 }, () => ({
    x: rand() * 1600,
    y: rand() * 560,
    r: rand() * 1.8 + 0.4,
    o: rand() * 0.6 + 0.4,
  }));
  const skies = [
    ["#0b1033", "#2a2466", "#7a4a8c"],
    ["#091a33", "#1d3a6b", "#5f7fb0"],
    ["#140b2e", "#3b1f5c", "#b06a7a"],
    ["#0a1f2a", "#1f4a5a", "#c58a5a"],
  ][variant % 4];
  const meteors = [
    [1180, 90, 260],
    [980, 170, 180],
    [1380, 230, 140],
  ].map(([x, y, len], i) => ({
    x: x - variant * 90 - i * 10,
    y: y + variant * 12,
    len,
  }));
  const id = `art${variant}`;
  return (
    <svg
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={skies[0]} />
          <stop offset="0.6" stopColor={skies[1]} />
          <stop offset="1" stopColor={skies[2]} />
        </linearGradient>
        <linearGradient id={`${id}-meteor`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#fff8d6" stopOpacity="1" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="900" fill={`url(#${id}-sky)`} />
      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o} />
      ))}
      <circle cx="260" cy="150" r="58" fill="#fdf3c8" opacity="0.95" />
      <circle cx="285" cy="135" r="52" fill={skies[0]} opacity="0.9" />
      {meteors.map((m, i) => (
        <g key={i} transform={`rotate(-28 ${m.x} ${m.y})`}>
          <rect
            x={m.x - m.len}
            y={m.y - 1.5}
            width={m.len}
            height="3"
            rx="1.5"
            fill={`url(#${id}-meteor)`}
          />
          <circle cx={m.x} cy={m.y} r="4" fill="#fffbe6" />
        </g>
      ))}
      <path
        d="M0 700 C 250 610 450 640 700 660 C 950 680 1150 600 1600 640 L1600 900 L0 900 Z"
        fill="#1b1f3f"
      />
      <path
        d="M0 780 C 300 720 600 760 900 750 C 1200 740 1400 700 1600 730 L1600 900 L0 900 Z"
        fill="#12152e"
      />
      {/* 喫茶店 */}
      <g transform="translate(980 470)">
        <circle cx="120" cy="150" r="190" fill={`url(#${id}-glow)`} opacity="0.35" />
        <rect x="0" y="90" width="250" height="170" fill="#2b2140" />
        <polygon points="-20,95 125,10 270,95" fill="#3d2b52" />
        <rect x="170" y="20" width="26" height="50" fill="#2b2140" />
        <rect x="24" y="130" width="62" height="52" rx="4" fill="#ffcf7a" />
        <rect x="164" y="130" width="62" height="52" rx="4" fill="#ffcf7a" />
        <line x1="55" y1="130" x2="55" y2="182" stroke="#2b2140" strokeWidth="4" />
        <line x1="195" y1="130" x2="195" y2="182" stroke="#2b2140" strokeWidth="4" />
        <rect x="102" y="170" width="46" height="90" rx="4" fill="#5a3b2a" />
        <circle cx="139" cy="218" r="3" fill="#ffcf7a" />
        <rect x="70" y="100" width="110" height="24" rx="4" fill="#1a1428" />
        <text
          x="125"
          y="117"
          textAnchor="middle"
          fontSize="14"
          fill="#ffcf7a"
          fontFamily="sans-serif"
        >
          ★ ほしふる珈琲
        </text>
      </g>
      {/* 街灯と木 */}
      <g transform="translate(860 560)">
        <rect x="0" y="0" width="6" height="150" fill="#0e1024" />
        <circle cx="3" cy="-6" r="12" fill="#ffe7a8" />
        <circle cx="3" cy="-6" r="40" fill={`url(#${id}-glow)`} opacity="0.5" />
      </g>
      <g transform="translate(1330 520)" fill="#0f1328">
        <rect x="18" y="80" width="12" height="120" />
        <circle cx="24" cy="60" r="60" />
        <circle cx="-10" cy="90" r="40" />
        <circle cx="60" cy="95" r="42" />
      </g>
    </svg>
  );
}
