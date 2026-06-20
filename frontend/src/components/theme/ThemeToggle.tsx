"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Light/dark theme toggle. The initial `.dark` class is applied before paint by
 * the no-FOUC script in layout.tsx. This control just flips that class and
 * persists the choice; the visible icon is driven purely by CSS (`dark:`
 * variant), so there is no React state and no hydration mismatch.
 */
export function ThemeToggle(): React.JSX.Element {
  const toggle = () => {
    const isDark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch {
      /* storage may be unavailable (private mode) — ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center justify-center rounded-md p-2 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
      title="テーマを切り替え"
      aria-label="ライト/ダークモードを切り替え"
    >
      <Sun className="hidden size-5 dark:block" aria-hidden />
      <Moon className="size-5 dark:hidden" aria-hidden />
    </button>
  );
}
