"use client";

import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Code2,
  Download,
  Heart,
  Home,
  Menu,
  MessageSquare,
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
  {
    label: "ご意見",
    href: "https://forms.gle/kKPbAPGY96rbaKgK8",
    icon: MessageSquare,
    external: true,
  },
];

function NavItem({ link }: { link: NavLink }): React.JSX.Element {
  const Icon = link.icon;
  const className =
    "flex items-center justify-center rounded-md p-2 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white";
  const content = (
    <>
      <Icon className="size-5" aria-hidden />
      <span className="sr-only">{link.label}</span>
    </>
  );
  if (link.external) {
    return (
      <a
        className={className}
        href={link.href}
        title={link.label}
        aria-label={link.label}
        target="_blank"
        rel="noreferrer noopener"
      >
        {content}
      </a>
    );
  }
  return (
    <Link
      className={className}
      href={link.href}
      title={link.label}
      aria-label={link.label}
    >
      {content}
    </Link>
  );
}

export function Header(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-neutral-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <Link href="/" className="inline-flex items-center" aria-label="d-party">
          <Logo className="size-10" />
        </Link>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded p-2 text-neutral-300 hover:text-white lg:hidden"
          aria-label="メニューを開閉"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>

        <ul className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <NavItem link={link} />
            </li>
          ))}
        </ul>
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
