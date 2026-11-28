import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, type LucideIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Announcements } from "@/components/Announcements";
import type { Announcement } from "@/domain/announcement";
import { fetchActiveAnnouncements } from "@/infrastructure/api/announcements";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@d-party/ui";

import { BrandHeader } from "./BrandHeader";
import { InfoPanel } from "./InfoPanel";
import { PersonalStatsPanel } from "./PersonalStatsPanel";
import { ReactionsPanel } from "./ReactionsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { TABS } from "./tabs";
import { useSettings } from "./useSettings";

/**
 * Inactive panels stay laid out, so the popup does not jump when switching tabs.
 *
 * `visibility` is animatable and inherited: a descendant with `transition-all`
 * (Button, the stats bars) would transition the inherited `hidden` and stay
 * visible for its duration, flashing over the next panel. Turn descendant
 * transitions off while inactive so they hide at the same instant.
 */
const HIDDEN_WHEN_INACTIVE =
  "data-[state=inactive]:invisible data-[state=inactive]:pointer-events-none data-[state=inactive]:**:transition-none";

/**
 * The 統計 panel sets the popup's height; the others overlay it and scroll
 * instead of stretching the window.
 */
const REFERENCE_PANEL = HIDDEN_WHEN_INACTIVE;
const OVERLAY_PANEL = `absolute inset-0 overflow-y-auto ${HIDDEN_WHEN_INACTIVE}`;

/**
 * Chrome caps a popup at 600px and scrolls the whole document beyond that. When
 * announcements push the popup past it, the panels shrink and scroll instead, so
 * the header, the announcements, the tabs and the footer stay in view.
 */
const POPUP_MAX_HEIGHT = "max-h-[600px]";

export interface PopupAppProps {
  /** 配信中のアナウンスの取得（Storybook で差し替える）。 */
  loadAnnouncements?: () => Promise<Announcement[]>;
}

export function PopupApp({
  loadAnnouncements = fetchActiveAnnouncements,
}: PopupAppProps): React.JSX.Element {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<string>(TABS[0].value);
  const reduce = useReducedMotion();
  const panelsRef = useRef<HTMLDivElement>(null);

  const changeTab = (value: string): void => {
    // 統計で下へスクロールしたまま切り替えると、重ねるパネルがその分ずれるので戻す。
    panelsRef.current?.scrollTo({ top: 0 });
    setTab(value);
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex min-h-[480px] ${POPUP_MAX_HEIGHT} flex-col bg-background text-foreground`}
    >
      <BrandHeader className="px-5 py-4">
        <OpenSettingsTabLink />
      </BrandHeader>

      <Announcements load={loadAnnouncements} itemClassName="px-4" />

      <Tabs value={tab} onValueChange={changeTab} className="min-h-0 gap-0">
        <TooltipProvider delayDuration={300}>
          <TabsList className="mx-4 mt-3 w-auto shrink-0">
            {TABS.map(({ value, label, icon }) => (
              <IconTab
                key={value}
                value={value}
                label={label}
                icon={icon}
                active={tab === value}
              />
            ))}
          </TabsList>
        </TooltipProvider>

        {/* The 統計 panel is in the flow, so it scrolls with this box; the
            overlays fill the box and scroll on their own. */}
        <div
          ref={panelsRef}
          className={`relative min-h-0 ${tab === "stats" ? "overflow-y-auto" : "overflow-hidden"}`}
        >
          <TabsContent value="settings" forceMount className={OVERLAY_PANEL}>
            <main className="p-4">
              <SettingsPanel settings={settings} update={update} />
            </main>
          </TabsContent>

          <TabsContent value="reaction" forceMount className={OVERLAY_PANEL}>
            <main className="p-4">
              <ReactionsPanel
                value={settings.extraReactions}
                onChange={(ids) => void update("extraReactions", ids)}
              />
            </main>
          </TabsContent>

          <TabsContent value="stats" forceMount className={REFERENCE_PANEL}>
            <main className="p-4">
              <PersonalStatsPanel />
            </main>
          </TabsContent>

          <TabsContent value="info" forceMount className={OVERLAY_PANEL}>
            <main className="p-4">
              <InfoPanel />
            </main>
          </TabsContent>
        </div>
      </Tabs>

      <footer className="mt-auto shrink-0 px-4 pb-3 pt-3 text-center text-[11px] text-muted-foreground">
        v{chrome.runtime.getManifest().version} · powered by U-Not
      </footer>
    </motion.div>
  );
}

const OPEN_SETTINGS_TAB_LABEL = "設定を別タブで開く";

/**
 * 設定タブ（options.html）を開く。開いていればそのタブへ移る。ポップアップは狭いので、
 * 同じ設定を広い画面で触れるようにする。360px のヘッダーでサブタイトルを折り返さない
 * よう、見える文言は短くし、全文はツールチップと読み上げで伝える。
 */
function OpenSettingsTabLink(): React.JSX.Element {
  const open = (): void => {
    // タブへフォーカスが移ればポップアップは閉じるが、念のため自分でも閉じる。
    void chrome.runtime.openOptionsPage().finally(() => window.close());
  };
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={open}
            aria-label={OPEN_SETTINGS_TAB_LABEL}
            className="flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            別タブ
            <ExternalLink className="size-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        {/* 右端のボタンなので、ポップアップの縁に張り付かないよう少し離す。 */}
        <TooltipContent collisionPadding={8}>
          {OPEN_SETTINGS_TAB_LABEL}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Shows the label only while active so four tabs fit the 360px popup. Inactive
 * tabs show it as a tooltip.
 */
function IconTab({
  value,
  label,
  icon: Icon,
  active,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
}): React.JSX.Element {
  const reduce = useReducedMotion();
  // Always render the Tooltip so the subtree is not remounted (that would cut the
  // label transition). `open` is always a boolean to keep it controlled.
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={active ? false : open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        {/* Wrapping in TooltipTrigger makes Radix Tooltip stamp its own
            data-state on the button, clobbering Tabs' data-state="active" — so
            the data-[state=active] styles in TabsTrigger no longer fire. Drive
            the active styling from our own `active` prop instead. */}
        <TabsTrigger
          value={value}
          aria-label={label}
          className={
            active ? "bg-card text-foreground shadow-sm" : undefined
          }
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <AnimatePresence initial={false}>
            {active && (
              <motion.span
                key="label"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={
                  reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }
                }
                className="inline-block overflow-hidden whitespace-nowrap"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </TabsTrigger>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
