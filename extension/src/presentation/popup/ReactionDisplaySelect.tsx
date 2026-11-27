import { ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

import {
  REACTION_DISPLAY_MODES,
  type ReactionDisplayMode,
} from "@/domain/settings";
import { cn } from "@d-party/ui";

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

export function ReactionDisplaySelect({
  value,
  onChange,
}: {
  value: ReactionDisplayMode;
  onChange: (mode: ReactionDisplayMode) => void;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-0.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/70"
      >
        <span className="flex items-center gap-3">
          <Sparkles
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="flex flex-col text-left">
            <span className="text-sm font-medium leading-tight">
              リアクションの表示方法
            </span>
            <span className="text-xs text-muted-foreground">
              {OPTIONS[value].label}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open && (
        <div role="radiogroup" className="mt-1 flex flex-col gap-1 px-1 pb-1">
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
                  setOpen(false);
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
