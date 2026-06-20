import { ArrowRight, Download } from "lucide-react";
import Link from "next/link";

import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { CHROME_WEBSTORE_URL } from "@/infrastructure/env";

const STEPS = [
  {
    title: "Google Chrome / Microsoft Edge に追加",
    text: "Chrome ウェブストアから d-party をインストール（Edge でも利用できます）。",
  },
  { title: "アニメを開く", text: "dアニメストアで一緒に観たい作品のプレイヤーを開く。" },
  { title: "リンクを共有", text: "生成されたルームリンクを友達に送るだけ。" },
  { title: "一緒に視聴", text: "全員そろったら再生。あとは自動でシンクします。" },
];

/** Landing page — modernised port of web/templates/index.html. */
export default function HomePage(): React.JSX.Element {
  return (
    <>
      <Hero />

      <Features />

      {/* How it works (summary → links to the full usage guide). */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">使い方はかんたん</h2>
          <p className="mt-3 text-muted-foreground">4 ステップで始められます。</p>
        </Reveal>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.08}>
              <li className="h-full rounded-2xl border border-border bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href="/usage">
              詳しい使い方を見る
              <ArrowRight />
            </Link>
          </Button>
        </Reveal>
      </section>

      {/* Final CTA. */}
      <section className="mx-auto max-w-5xl px-4 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border bg-card px-6 py-14 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary/10 to-transparent"
            />
            <h2 className="text-3xl font-bold tracking-tight">
              さあ、みんなでアニメを観よう
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              完全無料・広告なし。dアニメストアの作品を、離れた友達と同時視聴。
            </p>
            <div className="mt-8">
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
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
