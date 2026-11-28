/**
 * 利用マニュアル用: 作品ページのエピソード一覧に d-party のボタンが付いた様子。
 * 一覧は架空の配信サイト（マニュアルの画像はダークで揃えるので暗い配色）で、ボタンだけ
 * content-store と同じ CSS（public/css/style.css）を当てる。
 */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { MdGroups, MdPlayCircleFilled } from "react-icons/md";

import "../../public/css/style.css";

import { NightCafeArt, WORK_TITLE } from "./fixtures";

const EPISODES = [
  { no: "第1話", sub: "看板のない喫茶店", min: "23分" },
  { no: "第2話", sub: "真夜中のナポリタン", min: "23分" },
  { no: "第3話", sub: "流れ星のブレンド", min: "23分" },
  { no: "第4話", sub: "雨上がりのプリン", min: "23分" },
];

function OverlayButton({
  variant,
  tooltip,
  children,
}: {
  variant: "play" | "party";
  tooltip: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const [rect, setRect] = useState<DOMRect | null>(null);
  return (
    <>
      <button
        type="button"
        className={`dparty-btn dparty-btn--${variant}`}
        aria-label={tooltip}
        onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setRect(null)}
      >
        <span className="material-icons">{children}</span>
      </button>
      {rect && (
        <div
          className="dparty-tooltip dparty-tooltip--visible"
          style={{ left: rect.left + rect.width / 2, top: rect.top }}
        >
          {tooltip}
        </div>
      )}
    </>
  );
}

function StorePage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-neutral-100">
      <header className="flex h-14 items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-6">
        <div className="size-7 rounded-md bg-neutral-700" />
        <span className="text-sm font-semibold text-neutral-400">
          アニメ配信サイト（イメージ）
        </span>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-6">
        <section className="flex gap-6 rounded-lg bg-neutral-900 p-5 shadow-sm">
          <NightCafeArt variant={0} className="h-36 w-64 shrink-0 rounded-md" />
          <div>
            <h1 className="text-2xl font-bold">{WORK_TITLE}</h1>
            <p className="mt-2 text-sm leading-relaxed text-neutral-400">
              流れ星が毎晩降る小さな町。丘の上の喫茶店「ほしふる珈琲」には、願いごとを抱えたお客さんが今夜もやってくる。
            </p>
          </div>
        </section>
        <h2 className="mb-3 mt-6 text-sm font-semibold text-neutral-400">エピソード</h2>
        <div className="grid grid-cols-4 gap-4">
          {EPISODES.map((ep, i) => (
            <div key={ep.no} className="itemModule list">
              <section className="clearfix rounded-lg bg-neutral-900 pb-12 shadow-sm">
                <NightCafeArt variant={i} className="aspect-video w-full rounded-t-lg" />
                <div className="px-3 pt-2">
                  <p className="text-xs text-neutral-400">{ep.no}</p>
                  <p className="text-sm font-semibold">{ep.sub}</p>
                  <p className="mt-0.5 text-xs text-neutral-500">{ep.min}</p>
                </div>
                <div className="dparty-overlay">
                  <OverlayButton variant="play" tooltip="別タブで再生">
                    <MdPlayCircleFilled size={20} />
                  </OverlayButton>
                  <OverlayButton variant="party" tooltip="パーティールームを作成">
                    <MdGroups size={20} />
                  </OverlayButton>
                </div>
              </section>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

const meta: Meta = { title: "Manual/Store", parameters: { layout: "fullscreen" } };
export default meta;

export const EpisodeList: StoryObj = { render: () => <StorePage /> };
