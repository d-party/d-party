"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  Code2,
  Download,
  Heart,
  HelpCircle,
  Home,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { CHROME_WEBSTORE_URL } from "@/infrastructure/env";
import { cn } from "@/lib/utils";

type NavLink = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** External links open in a new tab. */
  external?: boolean;
};

/** Ported from web/templates/header.html (Bootstrap navbar → icon nav). */
const NAV_LINKS: NavLink[] = [
  { label: "ホーム", href: "/", icon: Home },
  { label: "使い方", href: "/usage", icon: BookOpen },
  { label: "Q&A", href: "/qa", icon: HelpCircle },
  {
    label: "ダウンロード",
    href: CHROME_WEBSTORE_URL,
    icon: Download,
    external: true,
  },
  { label: "開発", href: "https://github.com/d-Party", icon: Code2, external: true },
  {
    label: "寄付",
    href: "https://github.com/sponsors/d-party",
    icon: Heart,
    external: true,
  },
  { label: "統計", href: "/stats", icon: BarChart3 },
];

function NavItem({ link }: { link: NavLink }): React.JSX.Element {
  const Icon = link.icon;
  const className =
    "peer flex items-center justify-center rounded-md p-2 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white";
  const content = (
    <>
      <Icon className="size-5" aria-hidden />
      <span className="sr-only">{link.label}</span>
    </>
  );

  const tooltip = (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-neutral-800 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-md transition-all duration-150 peer-hover:translate-y-0 peer-hover:opacity-100 peer-focus-visible:translate-y-0 peer-focus-visible:opacity-100"
    >
      {link.label}
    </span>
  );

  return (
    <div className="relative">
      {link.external ? (
        <a
          className={className}
          href={link.href}
          aria-label={link.label}
          target="_blank"
          rel="noreferrer noopener"
        >
          {content}
        </a>
      ) : (
        <Link className={className} href={link.href} aria-label={link.label}>
          {content}
        </Link>
      )}
      {tooltip}
    </div>
  );
}

export function Header(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-neutral-900/50 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1">
        <Link href="/" className="inline-flex items-center" aria-label="d-party">
          <Logo className="size-9" />
        </Link>

        <div className="flex items-center gap-1">
          <ul className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <NavItem link={link} />
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded p-2 text-neutral-300 hover:text-white lg:hidden"
            aria-label="メニューを開閉"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-6" /> : <Menu className="size-6" />}
          </button>
        </div>
      </div>

      <ul
        className={cn(
          "flex flex-wrap gap-1 border-t border-neutral-800 px-4 pb-2 lg:hidden",
          open ? "flex" : "hidden",
        )}
      >
        {NAV_LINKS.map((link) => (
          <li key={link.label}>
            <NavItem link={link} />
          </li>
        ))}
      </ul>
    </nav>
  );
}
