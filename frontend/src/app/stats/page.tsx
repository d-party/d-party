import type { Metadata } from "next";

import { StatsDashboard } from "@/components/stats/StatsDashboard";

export const metadata: Metadata = {
  title: "統計",
  description: "d-party の利用統計（ユーザー数・ルーム数・リアクション数）。",
};

/** 既定の集計期間（日）。フロントは直近 1 年を固定表示する。 */
const DEFAULT_DAYS = 365;
const MAX_DAYS = 365;

/** URL の ``?days=N`` を 1〜365 にクランプする。未指定・不正なら 365（1 年）。 */
function resolveDays(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isFinite(value)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(1, Math.trunc(value)));
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const { days } = await searchParams;
  const period = resolveDays(days);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">統計情報</h1>
        <p className="mt-2 text-sm text-muted-foreground">直近 1 年間</p>
      </header>

      <StatsDashboard days={period} />
    </section>
  );
}
