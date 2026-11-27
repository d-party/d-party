import Image from "next/image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Lightbulb,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@d-party/ui";

import {
  DOC_CHAPTERS,
  DOCS_PATH,
  type DocSlug,
  docPath,
  findChapter,
} from "./chapters";
import { DOC_IMAGES, type DocImageName } from "./images";

/** 章のページの外枠。タイトル・リード文・本文・前後の章へのリンク。 */
export function DocArticle({
  slug,
  lead,
  children,
}: {
  slug: DocSlug;
  lead: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const chapter = findChapter(slug);
  return (
    <article className="min-w-0">
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-sm font-medium text-primary">
          利用マニュアル · {chapter.index + 1} / {DOC_CHAPTERS.length}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {chapter.title}
        </h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">{lead}</p>
      </header>
      <div className="space-y-12">{children}</div>
      <DocPager index={chapter.index} />
    </article>
  );
}

function DocPager({ index }: { index: number }): React.JSX.Element {
  const prev = index > 0 ? DOC_CHAPTERS[index - 1] : null;
  const next = index < DOC_CHAPTERS.length - 1 ? DOC_CHAPTERS[index + 1] : null;
  const card =
    "group flex flex-1 flex-col gap-1 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/60";
  return (
    <nav
      aria-label="前後の章"
      className="mt-16 flex flex-col gap-3 border-t border-border pt-8 sm:flex-row"
    >
      {prev ? (
        <Link href={docPath(prev.slug)} className={card}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronLeft className="size-3.5" aria-hidden /> 前の章
          </span>
          <span className="font-semibold group-hover:text-primary">
            {prev.title}
          </span>
        </Link>
      ) : (
        <Link href={DOCS_PATH} className={card}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <ChevronLeft className="size-3.5" aria-hidden /> 目次
          </span>
          <span className="font-semibold group-hover:text-primary">
            利用マニュアル
          </span>
        </Link>
      )}
      {next ? (
        <Link href={docPath(next.slug)} className={cn(card, "sm:items-end")}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            次の章 <ChevronRight className="size-3.5" aria-hidden />
          </span>
          <span className="font-semibold group-hover:text-primary">
            {next.title}
          </span>
        </Link>
      ) : (
        <Link href={DOCS_PATH} className={cn(card, "sm:items-end")}>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            目次へ戻る <ChevronRight className="size-3.5" aria-hidden />
          </span>
          <span className="font-semibold group-hover:text-primary">
            利用マニュアル
          </span>
        </Link>
      )}
    </nav>
  );
}

/** 章の中の節。`id` は目次からのアンカーになる。 */
export function DocSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <h2 className="text-2xl font-semibold tracking-tight">
        <a href={`#${id}`} className="hover:text-primary">
          {title}
        </a>
      </h2>
      <div className="space-y-4 leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function DocSubheading({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <h3 className="pt-2 text-lg font-semibold text-foreground">{children}</h3>
  );
}

/**
 * スクリーンショット。`maxWidth`（CSS px）を指定すると、ポップアップやサイドバーのような
 * 縦長の画像を拡大しすぎない。押すと原寸の画像を新しいタブで開く。
 */
export function DocFigure({
  name,
  alt,
  caption,
  maxWidth,
  preload = false,
}: {
  name: DocImageName;
  alt: string;
  caption?: React.ReactNode;
  maxWidth?: number;
  /** ページの先頭の画像（LCP）だけ true にする。 */
  preload?: boolean;
}): React.JSX.Element {
  const image = DOC_IMAGES[name];
  return (
    <figure className="my-6">
      <div
        className="mx-auto overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm"
        style={maxWidth ? { maxWidth } : undefined}
      >
        {/* 狭い画面では文字が読みにくいので、押すと原寸の画像を開けるようにする。 */}
        <a
          href={image.src}
          target="_blank"
          rel="noreferrer noopener"
          title="画像を原寸で開く"
          className="block"
        >
          <span className="sr-only">（原寸の画像を新しいタブで開く）</span>
          <Image
            src={image.src}
            width={image.width}
            height={image.height}
            alt={alt}
            preload={preload}
            sizes={maxWidth ? `${maxWidth}px` : "(min-width: 1024px) 768px, 100vw"}
            className="h-auto w-full"
          />
        </a>
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/** 縦長の画像を横に並べる（狭い画面では縦に積む）。 */
export function DocFigureRow({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="grid items-start gap-4 sm:grid-cols-2 [&_figure]:my-0">
      {children}
    </div>
  );
}

const CALLOUTS: Record<
  "tip" | "note" | "warning",
  { icon: LucideIcon; label: string; className: string }
> = {
  tip: {
    icon: Lightbulb,
    label: "ヒント",
    className: "border-emerald-500/40 bg-emerald-500/5 [&_svg]:text-emerald-400",
  },
  note: {
    icon: Info,
    label: "メモ",
    className: "border-sky-500/40 bg-sky-500/5 [&_svg]:text-sky-400",
  },
  warning: {
    icon: TriangleAlert,
    label: "注意",
    className: "border-amber-500/40 bg-amber-500/5 [&_svg]:text-amber-400",
  },
};

export function Callout({
  variant = "note",
  title,
  children,
}: {
  variant?: keyof typeof CALLOUTS;
  title?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const { icon: Icon, label, className } = CALLOUTS[variant];
  return (
    <aside
      className={cn("flex gap-3 rounded-lg border p-4 text-sm", className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1.5 leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">{title ?? label}</p>
        {children}
      </div>
    </aside>
  );
}

/** 番号つきの手順。 */
export function Steps({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ol className="space-y-3 [counter-reset:step]">{children}</ol>
  );
}

export function Step({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <li className="relative pl-10 [counter-increment:step] before:absolute before:left-0 before:top-0 before:flex before:size-7 before:items-center before:justify-center before:rounded-full before:bg-primary before:text-sm before:font-bold before:text-primary-foreground before:content-[counter(step)]">
      <p className="pt-0.5 font-semibold text-foreground">{title}</p>
      {children ? <div className="mt-1 space-y-2">{children}</div> : null}
    </li>
  );
}

/** 画面に出る文言・ボタン名。 */
export function Ui({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className="whitespace-nowrap rounded border border-border bg-muted px-1.5 py-0.5 text-[0.9em] font-medium text-foreground">
      {children}
    </span>
  );
}

export function Kbd({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <kbd className="rounded border border-b-2 border-border bg-card px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </kbd>
  );
}

export function DocLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const className = "text-primary underline-offset-4 hover:underline";
  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/** 説明つきの項目の一覧（設定項目・状態など）。 */
export function DefinitionList({
  items,
}: {
  items: { term: React.ReactNode; description: React.ReactNode }[];
}): React.JSX.Element {
  return (
    <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card text-sm">
      {items.map((item, i) => (
        <div key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
          <dt className="font-medium text-foreground">{item.term}</dt>
          <dd className="leading-relaxed text-muted-foreground">
            {item.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}
