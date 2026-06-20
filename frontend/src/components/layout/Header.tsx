"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { CHROME_WEBSTORE_URL } from "@/infrastructure/env";
import { cn } from "@/lib/utils";

type NavLink = {
  label: string;
  href: string;
  /** External links open in a new tab. */
  external?: boolean;
};

/** Ported from web/templates/header.html (Bootstrap navbar → Tailwind). */
const NAV_LINKS: NavLink[] = [
  { label: "ホーム", href: "/" },
  { label: "使い方", href: "/usage" },
  { label: "ダウンロード", href: CHROME_WEBSTORE_URL, external: true },
  { label: "開発", href: "https://github.com/d-Party", external: true },
  { label: "ご意見", href: "https://forms.gle/kKPbAPGY96rbaKgK8", external: true },
];

function NavItem({ link }: { link: NavLink }): React.JSX.Element {
  const className =
    "block px-3 py-2 text-sm text-neutral-300 transition-colors hover:text-white";
  if (link.external) {
    return (
      <a
        className={className}
        href={link.href}
        target="_blank"
        rel="noreferrer noopener"
      >
        {link.label}
      </a>
    );
  }
  return (
    <Link className={className} href={link.href}>
      {link.label}
    </Link>
  );
}

export function Header(): React.JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <nav className="bg-neutral-900 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <Link href="/" className="inline-flex items-center" aria-label="d-party">
          <Image
            src="/favicon/favicon-32x32.png"
            alt="d-party"
            width={40}
            height={40}
            className="rounded"
          />
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

        <ul className="hidden items-center lg:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <NavItem link={link} />
            </li>
          ))}
        </ul>
      </div>

      <ul
        className={cn(
          "border-t border-neutral-800 px-4 pb-2 lg:hidden",
          open ? "block" : "hidden",
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
