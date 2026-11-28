import { useState } from "react";

import { Announcements } from "@/components/Announcements";
import type { Announcement } from "@/domain/announcement";
import { fetchActiveAnnouncements } from "@/infrastructure/api/announcements";
import { BrandHeader } from "@/presentation/popup/BrandHeader";
import { InfoPanel } from "@/presentation/popup/InfoPanel";
import { PersonalStatsPanel } from "@/presentation/popup/PersonalStatsPanel";
import { ReactionsPanel } from "@/presentation/popup/ReactionsPanel";
import { SettingsPanel } from "@/presentation/popup/SettingsPanel";
import { TABS, type TabValue, toTabValue } from "@/presentation/popup/tabs";
import { useSettings } from "@/presentation/popup/useSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@d-party/ui";

const DESCRIPTIONS: Record<TabValue, string> = {
  settings:
    "表示名とアイコン、同時視聴とプレイヤーの設定です。変更はその場で保存されます。",
  reaction: "プレイヤーで送れるリアクションを、標準の 5 つに追加できます。",
  stats: "このブラウザでの利用状況です。d-party のサーバーには送られません。",
  info: "d-party の関連リンクです。",
};

/** 横幅を揃えるため、ヘッダー・本文・フッターで同じ最大幅を使う。 */
const CONTAINER = "mx-auto w-full max-w-5xl px-6";

/** 再読み込みしても同じ項目を開けるよう、選んでいる項目は URL の `#` に持つ。 */
function tabFromHash(): TabValue {
  return toTabValue(window.location.hash.slice(1));
}

export interface OptionsAppProps {
  /** 配信中のアナウンスの取得（Storybook で差し替える）。 */
  loadAnnouncements?: () => Promise<Announcement[]>;
}

/**
 * 別タブで開く設定ページ（options.html）。ポップアップと同じパネルを、畳まずに広く並べる。
 * 幅に応じた並べ方は、パネル側がこの `@container` に対するコンテナクエリで切り替える。
 */
export function OptionsApp({
  loadAnnouncements = fetchActiveAnnouncements,
}: OptionsAppProps): React.JSX.Element {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<TabValue>(tabFromHash);

  const changeTab = (value: string): void => {
    const next = toTabValue(value);
    setTab(next);
    history.replaceState(null, "", `#${next}`);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <BrandHeader className={`${CONTAINER} py-4`} />

      <div className={`${CONTAINER} flex-1`}>
        <Announcements load={loadAnnouncements} />

        <Tabs
          value={tab}
          onValueChange={changeTab}
          orientation="vertical"
          className="gap-6 py-6 md:flex-row md:items-start md:gap-8"
        >
          <TabsList
            aria-label="設定の項目"
            className="shrink-0 md:sticky md:top-6 md:h-auto md:w-48 md:flex-col md:items-stretch md:gap-1 md:bg-transparent md:p-0"
          >
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="hover:text-foreground md:flex-none md:justify-start md:gap-2.5 md:px-3 md:py-2 md:text-sm md:hover:bg-muted/60 md:data-[state=active]:bg-muted md:data-[state=active]:shadow-none data-[state=active]:[&>svg]:text-red-600"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="@container min-w-0 flex-1">
            <TabsContent value="settings">
              <PanelHeading value="settings" />
              <SettingsPanel settings={settings} update={update} layout="page" />
            </TabsContent>

            <TabsContent value="reaction">
              <PanelHeading value="reaction" />
              <ReactionsPanel
                value={settings.extraReactions}
                onChange={(ids) => void update("extraReactions", ids)}
                layout="page"
              />
            </TabsContent>

            <TabsContent value="stats">
              <PanelHeading value="stats" />
              <PersonalStatsPanel />
            </TabsContent>

            <TabsContent value="info">
              <PanelHeading value="info" />
              <InfoPanel />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <footer className="shrink-0 border-t py-4 text-center text-xs text-muted-foreground">
        v{chrome.runtime.getManifest().version} · powered by U-Not
      </footer>
    </div>
  );
}

function PanelHeading({ value }: { value: TabValue }): React.JSX.Element {
  const label = TABS.find((tab) => tab.value === value)?.label;
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold tracking-tight">{label}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTIONS[value]}</p>
    </div>
  );
}
