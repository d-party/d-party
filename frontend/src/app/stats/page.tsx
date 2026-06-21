import type { Metadata } from "next";

import { StatsDashboard } from "@/components/stats/StatsDashboard";

export const metadata: Metadata = {
  title: "統計",
  description: "d-party の利用統計（ユーザー数・ルーム数・リアクション数）。",
};

export default function StatsPage(): React.JSX.Element {
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight">統計情報</h1>
      </header>

      <StatsDashboard />
    </section>
  );
}
