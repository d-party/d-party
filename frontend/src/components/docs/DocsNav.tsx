"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";

import { cn } from "@d-party/ui";

import { DOC_CHAPTERS, DOCS_PATH, docPath } from "./chapters";

/** マニュアルの目次。広い画面では左に固定し、狭い画面では本文の上に出す。 */
export function DocsNav(): React.JSX.Element {
  const pathname = usePathname();
  const item = (href: string, label: string, number?: number) => {
    const active = pathname === href;
    return (
      <li key={href}>
        <Link
          href={href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-baseline gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
            active
              ? "bg-primary/10 font-semibold text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {number !== undefined ? (
            <span className="w-4 shrink-0 text-right text-xs tabular-nums opacity-70">
              {number}
            </span>
          ) : null}
          {label}
        </Link>
      </li>
    );
  };

  return (
    <nav aria-label="利用マニュアルの目次" className="lg:sticky lg:top-6">
      <Link
        href={DOCS_PATH}
        className="mb-3 flex items-center gap-2 px-3 text-sm font-bold"
      >
        <BookOpen className="size-4 text-primary" aria-hidden />
        利用マニュアル
      </Link>
      <ul className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
        {item(DOCS_PATH, "目次")}
        {DOC_CHAPTERS.map((chapter, i) =>
          item(docPath(chapter.slug), chapter.title, i + 1),
        )}
      </ul>
    </nav>
  );
}
