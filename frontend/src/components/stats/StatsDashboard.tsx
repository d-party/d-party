"use client";

import { useEffect, useState } from "react";

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

type Bar = { label: string; value: number };

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

/** Dependency-free responsive bar chart for the per-day series. */
function BarChart({
  data,
  loading,
}: {
  data: Bar[];
  loading: boolean;
}): React.JSX.Element {
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
      <div className="flex h-44 items-end gap-px">
        {data.map((d, i) => (
          <div
            key={`${d.label}-${i}`}
            title={`${d.label}: ${d.value}`}
            style={{ height: `${(d.value / max) * 100}%` }}
            className="min-h-[2px] flex-1 rounded-t bg-primary/80 transition-colors hover:bg-primary"
          />
        ))}
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

export function StatsDashboard(): React.JSX.Element {
  const [totals, setTotals] = useState<Totals | null>(null);
  const [userSeries, setUserSeries] = useState<Bar[]>([]);
  const [roomSeries, setRoomSeries] = useState<Bar[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
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
        if (cancelled) return;
        setTotals({
          userAll: userAll.data.data.count,
          roomAll: roomAll.data.data.count,
          reactionAll: reactionAll.data.data.count,
          userAlive: userAlive.data.data.count,
          roomAlive: roomAlive.data.data.count,
        });
        setUserSeries(toBars(userPerDay.data.data));
        setRoomSeries(toBars(roomPerDay.data.data));
        setReactions(reactionByType.data.data);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
        統計情報を取得できませんでした。時間をおいて再度お試しください。
      </p>
    );
  }

  const loading = totals === null;
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
          <BarChart data={userSeries} loading={loading} />
        </section>
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold">1日ごとのルーム数</h2>
          <BarChart data={roomSeries} loading={loading} />
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-semibold">リアクション種別ごとの累計</h2>
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-28 shrink-0" />
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
            {reactions.map((r) => (
              <li key={r.reaction_type} className="flex items-center gap-3">
                <span className="w-28 shrink-0 truncate text-sm text-muted-foreground">
                  {r.reaction_type}
                </span>
                <span
                  className="h-3 rounded bg-primary/80"
                  style={{ width: `${(r.count / maxReaction) * 100}%` }}
                />
                <span className="text-sm tabular-nums">{r.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
