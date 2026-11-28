import { Users } from "lucide-react";

import { cn } from "@d-party/ui";

/**
 * ポップアップと設定タブのヘッダー。テーマの対象外で、ダーク前提の固定色。
 * `className` は内側の行（余白や最大幅）に当て、`children` は右端に置く。
 */
export function BrandHeader({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <header className="shrink-0 border-b-2 border-red-600 bg-neutral-950 text-white">
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
          <Users className="size-5 text-red-600" aria-hidden />
        </div>
        <div className="leading-tight">
          <h1 className="text-base font-bold tracking-tight text-red-600">
            d-party
          </h1>
          <p className="text-xs text-white/70">dアニメストア・DMM TV 同時視聴の設定</p>
        </div>
        {children && <div className="ml-auto shrink-0">{children}</div>}
      </div>
    </header>
  );
}
