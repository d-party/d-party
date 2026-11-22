import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  ChevronDown,
  ExternalLink,
  Eye,
  type LucideIcon,
  MonitorPlay,
  PictureInPicture2,
  SlidersHorizontal,
  Smile,
} from "lucide-react";
import { useState } from "react";

import type { Settings } from "@/domain/settings";
import { Switch, cn } from "@d-party/ui";

import { ReactionDisplaySelect } from "./ReactionDisplaySelect";
import { UserProfileSection } from "./UserProfileSection";
import type { UpdateSetting } from "./useSettings";

type ToggleKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

interface Toggle {
  key: ToggleKey;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Show the inverse, so ON means "enabled" even for keys like `hideReaction`. */
  invert?: boolean;
}

const SYNC_TOGGLES: Toggle[] = [
  {
    key: "hideReaction",
    label: "リアクションを表示",
    description: "他の人のリアクション演出を表示する",
    icon: Eye,
    invert: true,
  },
  {
    key: "hideReactionIcon",
    label: "リアクションボタンを表示",
    description: "プレイヤーのリアクションボタンを表示する",
    icon: Smile,
    invert: true,
  },
  {
    // 保存値は名前と逆で、true が「通知しない」。既存ユーザーの値を保つためそのままにしている。
    key: "selfNotification",
    label: "自分の操作を通知",
    description: "自分の再生操作を通知する",
    icon: Bell,
    invert: true,
  },
];

const UTILITY_TOGGLES: Toggle[] = [
  {
    key: "autoAnotherTab",
    label: "動画は全て別タブで開く",
    description: "再生を常に新しいタブで開く",
    icon: ExternalLink,
  },
  {
    key: "enablePictureInPicture",
    label: "ピクチャーインピクチャーを有効",
    description: "プレイヤーに PiP ボタンを表示する",
    icon: PictureInPicture2,
  },
];

type SectionId = "sync" | "utility";

export function SettingsPanel({
  settings,
  update,
}: {
  settings: Settings;
  update: UpdateSetting;
}): React.JSX.Element {
  // Held here so only one section is open at a time.
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const toggleSection = (id: SectionId): void =>
    setOpenSection((current) => (current === id ? null : id));

  return (
    <div className="space-y-3">
      <UserProfileSection settings={settings} update={update} />

      <ToggleSection
        title="同時視聴設定"
        icon={MonitorPlay}
        toggles={SYNC_TOGGLES}
        settings={settings}
        update={update}
        open={openSection === "sync"}
        onToggle={() => toggleSection("sync")}
      >
        <ReactionDisplaySelect
          value={settings.reactionDisplay}
          onChange={(mode) => void update("reactionDisplay", mode)}
        />
      </ToggleSection>

      <ToggleSection
        title="ユーティリティ設定"
        icon={SlidersHorizontal}
        toggles={UTILITY_TOGGLES}
        settings={settings}
        update={update}
        open={openSection === "utility"}
        onToggle={() => toggleSection("utility")}
      />
    </div>
  );
}

function ToggleSection({
  title,
  icon: Icon,
  toggles,
  settings,
  update,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: LucideIcon;
  toggles: Toggle[];
  settings: Settings;
  update: UpdateSetting;
  open: boolean;
  onToggle: () => void;
  /** トグルの下に置くもの。 */
  children?: React.ReactNode;
}): React.JSX.Element {
  const reduce = useReducedMotion();
  return (
    <section className="rounded-xl border bg-card p-2 shadow-sm">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/70"
      >
        <Icon className="size-4 text-red-600" aria-hidden />
        <h2 className="text-sm font-semibold">{title}</h2>
        <ChevronDown
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={
              reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }
            }
            className="overflow-hidden"
          >
            <div className="mt-1 space-y-0.5">
              {toggles.map((toggle) => (
                <ToggleRow
                  key={toggle.key}
                  toggle={toggle}
                  value={settings[toggle.key]}
                  onChange={(value) => void update(toggle.key, value)}
                />
              ))}
            </div>
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ToggleRow({
  toggle: { key, label, description, icon: Icon, invert },
  value,
  onChange,
}: {
  toggle: Toggle;
  /** The stored value, before `invert`. */
  value: boolean;
  onChange: (value: boolean) => void;
}): React.JSX.Element {
  return (
    <label
      htmlFor={key}
      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/70"
    >
      <span className="flex items-center gap-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="flex flex-col">
          <span className="text-sm font-medium leading-tight">{label}</span>
          <span className="text-xs text-muted-foreground">{description}</span>
        </span>
      </span>
      <Switch
        id={key}
        checked={invert ? !value : value}
        onCheckedChange={(checked) => onChange(invert ? !checked : checked)}
      />
    </label>
  );
}
