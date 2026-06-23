"use client";

import { useMemo } from "react";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  LinearScale,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Bar as BarChartJS } from "react-chartjs-2";
import type { IconType } from "react-icons";
import {
  FaHandMiddleFinger,
  FaHeart,
  FaSadCry,
  FaSmileBeam,
  FaThumbsUp,
} from "react-icons/fa";
import { useAsync } from "react-use";

import {
  statsActiveRoomPerDay,
  statsActiveUserPerDay,
  statsReactionAllCount,
  statsReactionCount,
  statsRoomAliveCount,
  statsRoomAllCount,
  statsUserAliveCount,
  statsUserAllCount,
} from "@/infrastructure/api/generated/d-party";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerDayResultDataItem } from "@/infrastructure/api/generated/model";

type Totals = {
  userAll: number;
  roomAll: number;
  reactionAll: number;
  userAlive: number;
  roomAlive: number;
};

type ReactionRow = { reaction_type: string; count: number };

/**
 * Icon + label per reaction type, keyed by the backend `reaction_type` label
 * (`streamer.models.ReactionType`). Icons mirror the player's reaction buttons
 * (`react-icons/fa`) so the stats match what users tap in the extension.
 */
const REACTION_META: Record<string, { Icon: IconType; label: string }> = {
  favorite: { Icon: FaHeart, label: "お気に入り" },
  thumbs_up: { Icon: FaThumbsUp, label: "いいね" },
  smile: { Icon: FaSmileBeam, label: "笑顔" },
  cry: { Icon: FaSadCry, label: "涙" },
  middle_finger: { Icon: FaHandMiddleFinger, label: "ブーイング" },
};

type Bar = { label: string; value: number };

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

/**
 * Resolve a CSS custom property to a concrete color string for the canvas.
 * Chart.js draws on a <canvas>, which cannot resolve `var(--…)` itself.
 */
function cssColor(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** Pseudo-random but stable heights so the skeleton bars look chart-like. */
const SKELETON_BAR_HEIGHTS = [40, 65, 30, 80, 55, 70, 45, 90, 35, 60, 50, 75];

function BarChartSkeleton(): React.JSX.Element {
  return (
    <div>
      <div className="flex h-44 items-end gap-px">
        {SKELETON_BAR_HEIGHTS.map((h, i) => (
          <Skeleton
            key={i}
            style={{ height: `${h}%` }}
            className="min-h-[2px] flex-1 rounded-t rounded-b-none"
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * Responsive per-day bar chart built on Chart.js.
 *
 * Visually matches the previous hand-rolled bars (thin primary bars with
 * rounded tops, no axes, first/最大/last footer) but adds a proper hover
 * tooltip so the exact day and count are readable on mouse-over.
 */
function BarChart({
  data,
  loading,
  unit,
}: {
  data: Bar[];
  loading: boolean;
  unit: string;
}): React.JSX.Element {
  const chart = useMemo(() => {
    const primary = cssColor("--primary", "oklch(0.637 0.237 25.331)");
    const card = cssColor("--card", "oklch(0.215 0.01 270)");
    const cardForeground = cssColor("--card-foreground", "oklch(0.985 0 0)");
    const barColor = `color-mix(in oklch, ${primary} 80%, transparent)`;

    const chartData = {
      labels: data.map((d) => d.label),
      datasets: [
        {
          data: data.map((d) => d.value),
          backgroundColor: barColor,
          hoverBackgroundColor: primary,
          borderRadius: 4,
          borderSkipped: "bottom" as const,
          categoryPercentage: 1,
          barPercentage: 0.9,
        },
      ],
    };

    const options: ChartOptions<"bar"> = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { display: false },
        y: { display: false, beginAtZero: true },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: card,
          titleColor: cardForeground,
          bodyColor: cardForeground,
          borderColor: primary,
          borderWidth: 1,
          padding: 8,
          displayColors: false,
          callbacks: {
            label: (item) => `${item.formattedValue} ${unit}`,
          },
        },
      },
    };

    return { chartData, options };
  }, [data, unit]);

  if (loading) {
    return <BarChartSkeleton />;
  }
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">データがありません。</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  const first = data[0]?.label ?? "";
  const last = data[data.length - 1]?.label ?? "";
  return (
    <div>
      <div className="h-44">
        <BarChartJS data={chart.chartData} options={chart.options} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{first}</span>
        <span>最大 {max}</span>
        <span>{last}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: number | null;
  loading: boolean;
}): React.JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading || value === null ? (
        <Skeleton className="mt-2 h-9 w-20" />
      ) : (
        <p className="mt-2 text-3xl font-bold tabular-nums">
          {value.toLocaleString()}
        </p>
      )}
    </div>
  );
}

const toBars = (rows: PerDayResultDataItem[]): Bar[] =>
  rows.map((r) => ({ label: String(r.day), value: r.count }));

type StatsData = {
  totals: Totals;
  userSeries: Bar[];
  roomSeries: Bar[];
  reactions: ReactionRow[];
};

export function StatsDashboard(): React.JSX.Element {
  const { loading, error, value } = useAsync(async (): Promise<StatsData> => {
    const [
      userAll,
      roomAll,
      reactionAll,
      userAlive,
      roomAlive,
      userPerDay,
      roomPerDay,
      reactionByType,
    ] = await Promise.all([
      statsUserAllCount(),
      statsRoomAllCount(),
      statsReactionAllCount(),
      statsUserAliveCount(),
      statsRoomAliveCount(),
      statsActiveUserPerDay(),
      statsActiveRoomPerDay(),
      statsReactionCount(),
    ]);
    return {
      totals: {
        userAll: userAll.data.data.count,
        roomAll: roomAll.data.data.count,
        reactionAll: reactionAll.data.data.count,
        userAlive: userAlive.data.data.count,
        roomAlive: roomAlive.data.data.count,
      },
      userSeries: toBars(userPerDay.data.data),
      roomSeries: toBars(roomPerDay.data.data),
      reactions: reactionByType.data.data,
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        統計情報を取得できませんでした。時間をおいて再度お試しください。
      </p>
    );
  }

  const totals = value?.totals ?? null;
  const userSeries = value?.userSeries ?? [];
  const roomSeries = value?.roomSeries ?? [];
  const reactions = value?.reactions ?? [];
  const maxReaction = Math.max(1, ...reactions.map((r) => r.count));

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="累計ユーザー" value={totals?.userAll ?? null} loading={loading} />
        <StatCard label="累計ルーム" value={totals?.roomAll ?? null} loading={loading} />
        <StatCard
          label="累計リアクション"
          value={totals?.reactionAll ?? null}
          loading={loading}
        />
        <StatCard label="接続中ユーザー" value={totals?.userAlive ?? null} loading={loading} />
        <StatCard label="接続中ルーム" value={totals?.roomAlive ?? null} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">1日ごとのユーザー数</h2>
          <BarChart data={userSeries} loading={loading} unit="ユーザー" />
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">1日ごとのルーム数</h2>
          <BarChart data={roomSeries} loading={loading} unit="ルーム" />
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold">リアクション種別ごとの累計</h2>
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <Skeleton className="h-5 w-6 shrink-0" />
                <Skeleton
                  className="h-3"
                  style={{ width: `${90 - i * 15}%` }}
                />
              </li>
            ))}
          </ul>
        ) : reactions.length === 0 ? (
          <p className="text-sm text-muted-foreground">データがありません。</p>
        ) : (
          <ul className="space-y-2">
            {reactions.map((r) => {
              const meta = REACTION_META[r.reaction_type];
              return (
                <li key={r.reaction_type} className="flex items-center gap-3">
                  <span
                    className="flex w-6 shrink-0 justify-center text-muted-foreground"
                    title={meta?.label ?? r.reaction_type}
                    aria-label={meta?.label ?? r.reaction_type}
                  >
                    {meta ? (
                      <meta.Icon className="h-5 w-5" aria-hidden />
                    ) : (
                      <span className="truncate text-sm">{r.reaction_type}</span>
                    )}
                  </span>
                  <span
                    className="h-3 rounded bg-primary/80"
                    style={{ width: `${(r.count / maxReaction) * 100}%` }}
                  />
                  <span className="text-sm tabular-nums">{r.count.toLocaleString()}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
