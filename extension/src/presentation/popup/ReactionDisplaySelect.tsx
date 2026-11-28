import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import {
  REACTION_DISPLAY_MODES,
  type ReactionDisplayMode,
} from "@/domain/settings";
import { cn } from "@d-party/ui";

import type { PanelLayout } from "./tabs";

const OPTIONS: Record<
  ReactionDisplayMode,
  { label: string; description: string }
> = {
  normal: {
    label: "通常表示",
    description: "下から上へ浮かび上がる（現状）",
  },
  badge: {
    label: "バッジ表示",
    description: "右下に「名前 : リアクション」を小さく表示",
  },
  left: {
    label: "左寄り表示",
    description: "左側を揺れながら下から上へ移動",
  },
};

const TITLE = "リアクションの表示方法";

export function ReactionDisplaySelect({
  value,
  onChange,
  layout = "popup",
}: {
  value: ReactionDisplayMode;
  onChange: (mode: ReactionDisplayMode) => void;
  /** `page`（設定タブ）では選択肢を畳まずに並べる。 */
  layout?: PanelLayout;
}): React.JSX.Element {
  const collapsible = layout === "popup";
  const [open, setOpen] = useState(false);
  const expanded = !collapsible || open;

  const heading = (
    <span className="flex items-center gap-3">
      <Sparkles className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex flex-col text-left">
        <span className="text-sm font-medium leading-tight">{TITLE}</span>
        <span className="text-xs text-muted-foreground">
          {collapsible ? OPTIONS[value].label : "プレイヤーでのリアクションの見え方"}
        </span>
      </span>
    </span>
  );

  return (
    <div className="mt-0.5">
      {collapsible ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/70"
        >
          {heading}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
      ) : (
        <div className="px-2 py-2.5">{heading}</div>
      )}
      {expanded && (
        <div
          role="radiogroup"
          aria-label={TITLE}
          className="mt-1 flex flex-col gap-1 px-1 pb-1 @lg:grid @lg:grid-cols-3 @lg:gap-2"
        >
          {REACTION_DISPLAY_MODES.map((mode) => {
            const selected = mode === value;
            return (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  onChange(mode);
                  if (collapsible) setOpen(false);
                }}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2 text-left transition-colors",
                  selected
                    ? "border-red-600 bg-red-600/5"
                    : "border-border hover:bg-muted/70",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-red-600" : "border-muted-foreground/40",
                  )}
                >
                  {selected && (
                    <span className="size-2 rounded-full bg-red-600" />
                  )}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium leading-tight">
                    {OPTIONS[mode].label}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {OPTIONS[mode].description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
