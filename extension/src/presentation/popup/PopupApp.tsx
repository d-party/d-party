import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  Info,
  type LucideIcon,
  Settings as SettingsIcon,
  Smile,
  Users,
} from "lucide-react";
import { useState } from "react";

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

import { InfoPanel } from "./InfoPanel";
import { PersonalStatsPanel } from "./PersonalStatsPanel";
import { ReactionsPanel } from "./ReactionsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { useSettings } from "./useSettings";

const TABS = [
  { value: "settings", label: "設定", icon: SettingsIcon },
  { value: "reaction", label: "リアクション", icon: Smile },
  { value: "stats", label: "統計", icon: BarChart3 },
  { value: "info", label: "情報", icon: Info },
] as const satisfies readonly { value: string; label: string; icon: LucideIcon }[];

/** Inactive panels stay laid out, so the popup does not jump when switching tabs. */
const HIDDEN_WHEN_INACTIVE =
  "data-[state=inactive]:invisible data-[state=inactive]:pointer-events-none";

/**
 * The 統計 panel sets the popup's height; the others overlay it and scroll
 * instead of stretching the window.
 */
const REFERENCE_PANEL = HIDDEN_WHEN_INACTIVE;
const OVERLAY_PANEL = `absolute inset-0 overflow-y-auto ${HIDDEN_WHEN_INACTIVE}`;

export function PopupApp(): React.JSX.Element {
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<string>(TABS[0].value);
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex min-h-[480px] flex-col bg-background text-foreground"
    >
      <header className="border-b-2 border-red-600 bg-neutral-950 px-5 py-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
            <Users className="size-5 text-red-600" aria-hidden />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight text-red-600">
              d-party
            </h1>
            <p className="text-xs text-white/70">
              dアニメストア 同時視聴の設定
            </p>
          </div>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="gap-0">
        <TooltipProvider delayDuration={300}>
          <TabsList className="mx-4 mt-3 w-auto">
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

        <div className="relative">
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

      <footer className="mt-auto px-4 pb-3 pt-3 text-center text-[11px] text-muted-foreground">
        v{chrome.runtime.getManifest().version} · powered by U-Not
      </footer>
    </motion.div>
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
