import { motion, useReducedMotion } from "framer-motion";

import { Announcements } from "@/components/Announcements";
import type { Announcement } from "@/domain/announcement";
import { fetchActiveAnnouncements } from "@/infrastructure/api/announcements";
import { BrandHeader } from "@/presentation/popup/BrandHeader";
import { InfoPanel } from "@/presentation/popup/InfoPanel";
import { PersonalStatsPanel } from "@/presentation/popup/PersonalStatsPanel";
import { ReactionsPanel } from "@/presentation/popup/ReactionsPanel";
import { SettingsPanel } from "@/presentation/popup/SettingsPanel";
import { TABS, type TabValue } from "@/presentation/popup/tabs";
import { useSettings } from "@/presentation/popup/useSettings";
import { cn } from "@d-party/ui";

import { useScrollSpy } from "./useScrollSpy";

const DESCRIPTIONS: Record<TabValue, string> = {
  settings:
    "表示名とアイコン、同時視聴とプレイヤーの設定です。変更はその場で保存されます。",
  reaction: "プレイヤーで送れるリアクションを、標準の 5 つに追加できます。",
  stats: "このブラウザでの利用状況です。d-party のサーバーには送られません。",
  info: "d-party の関連リンクです。",
};

/** ページの項目（= 各セクションの id）。`useScrollSpy` の依存に使うので固定の配列にする。 */
const SECTION_IDS: readonly TabValue[] = TABS.map((tab) => tab.value);

/** 横幅を揃えるため、ヘッダー・本文・フッターで同じ最大幅を使う。 */
const CONTAINER = "mx-auto w-full max-w-5xl px-6";

export interface OptionsAppProps {
  /** 配信中のアナウンスの取得（Storybook で差し替える）。 */
  loadAnnouncements?: () => Promise<Announcement[]>;
}

/**
 * 別タブで開く設定ページ（options.html）。ポップアップと同じパネルを、畳まずに上から順に
 * 1 枚のページへ並べる。左のメニュー（狭い画面では上）は押すとその項目までスクロールし、
 * 表示している位置に合わせて選択が移る。
 *
 * 幅に応じた並べ方は、パネル側が `main` の `@container` に対するコンテナクエリで切り替える。
 */
export function OptionsApp({
  loadAnnouncements = fetchActiveAnnouncements,
}: OptionsAppProps): React.JSX.Element {
  const { settings, update } = useSettings();
  const reduce = useReducedMotion() ?? false;
  const { active, scrollTo } = useScrollSpy(SECTION_IDS, { smooth: !reduce });

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <BrandHeader className={`${CONTAINER} py-4`} />

      <div className={`${CONTAINER} flex-1`}>
        <Announcements load={loadAnnouncements} />

        <div className="pb-12 md:flex md:items-start md:gap-8 md:pt-6">
          <nav
            aria-label="設定の項目"
            className="sticky top-0 z-10 -mx-6 bg-background/95 px-6 py-3 backdrop-blur md:top-6 md:mx-0 md:w-48 md:shrink-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
          >
            <ul className="flex rounded-lg bg-muted p-1 md:flex-col md:gap-1 md:bg-transparent md:p-0">
              {TABS.map(({ value, label, icon: Icon }) => {
                const current = value === active;
                return (
                  <li key={value} className="flex-1 md:flex-none">
                    <a
                      href={`#${value}`}
                      aria-current={current ? "true" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        scrollTo(value);
                      }}
                      className={cn(
                        "relative flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:justify-start md:gap-2.5 md:px-3 md:py-2 md:text-sm",
                        current
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground md:hover:bg-muted/50",
                      )}
                    >
                      {current && (
                        // 選択が移るときは、背景が次の項目へ滑って移る。
                        <motion.span
                          layoutId="options-nav-active"
                          transition={
                            reduce
                              ? { duration: 0 }
                              : { type: "spring", bounce: 0.15, duration: 0.35 }
                          }
                          className="absolute inset-0 rounded-md bg-card shadow-sm md:bg-muted md:shadow-none"
                          aria-hidden
                        />
                      )}
                      <Icon
                        className={cn(
                          "relative size-4 shrink-0 transition-colors",
                          current && "text-red-600",
                        )}
                        aria-hidden
                      />
                      <span className="relative">{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <main className="@container min-w-0 flex-1 space-y-14 pt-4 md:pt-0">
            <OptionsSection id="settings">
              <SettingsPanel settings={settings} update={update} layout="page" />
            </OptionsSection>

            <OptionsSection id="reaction">
              <ReactionsPanel
                value={settings.extraReactions}
                onChange={(ids) => void update("extraReactions", ids)}
                layout="page"
              />
            </OptionsSection>

            <OptionsSection id="stats">
              <PersonalStatsPanel />
            </OptionsSection>

            <OptionsSection id="info">
              <InfoPanel />
            </OptionsSection>
          </main>
        </div>
      </div>

      <footer className="shrink-0 border-t py-4 text-center text-xs text-muted-foreground">
        v{chrome.runtime.getManifest().version} · powered by U-Not
      </footer>
    </div>
  );
}

/**
 * 1 項目。メニューから移ったときにフォーカスを受けられるよう `tabIndex={-1}` にする。
 * 狭い画面では上に固定したメニューの下に見出しが隠れないよう、`scroll-margin` を広めに取る。
 */
function OptionsSection({
  id,
  children,
}: {
  id: TabValue;
  children: React.ReactNode;
}): React.JSX.Element {
  const label = TABS.find((tab) => tab.value === id)?.label;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      tabIndex={-1}
      className="scroll-mt-20 outline-none md:scroll-mt-6"
    >
      <div className="mb-4">
        <h2 id={`${id}-heading`} className="text-lg font-bold tracking-tight">
          {label}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTIONS[id]}</p>
      </div>
      {children}
    </section>
  );
}
