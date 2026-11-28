"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown } from "lucide-react";

import { cn } from "@d-party/ui";

import { DOC_CHAPTERS, DOCS_PATH, docPath } from "./chapters";

const ITEMS = [
  { href: DOCS_PATH, label: "目次", number: undefined },
  ...DOC_CHAPTERS.map((chapter, i) => ({
    href: docPath(chapter.slug),
    label: chapter.title,
    number: i + 1,
  })),
];

function NavList({ pathname }: { pathname: string }): React.JSX.Element {
  return (
    <ul className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
      {ITEMS.map(({ href, label, number }) => {
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
      })}
    </ul>
  );
}

/**
 * マニュアルの目次。広い画面では左に固定し、狭い画面では本文の上に折りたたんで出す
 * （開くと全章が並ぶ。章を移ると閉じる）。
 */
export function DocsNav(): React.JSX.Element {
  const pathname = usePathname();
  const current = ITEMS.find((item) => item.href === pathname);

  return (
    <nav aria-label="利用マニュアルの目次">
      <details key={pathname} className="group lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-1 text-sm [&::-webkit-details-marker]:hidden">
          <BookOpen className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="font-bold">利用マニュアル</span>
          {current ? (
            <span className="min-w-0 truncate text-muted-foreground">
              {current.number !== undefined
                ? `${current.number}. ${current.label}`
                : current.label}
            </span>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="group-open:hidden">目次を開く</span>
            <span className="hidden group-open:inline">閉じる</span>
            <ChevronDown
              className="size-4 transition-transform group-open:rotate-180"
              aria-hidden
            />
          </span>
        </summary>
        <div className="mt-3">
          <NavList pathname={pathname} />
        </div>
      </details>

      <div className="hidden lg:block">
        <Link
          href={DOCS_PATH}
          className="mb-3 flex items-center gap-2 px-3 text-sm font-bold"
        >
          <BookOpen className="size-4 text-primary" aria-hidden />
          利用マニュアル
        </Link>
        <NavList pathname={pathname} />
      </div>
    </nav>
  );
}
