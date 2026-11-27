import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { TriangleExclamationPoint, X } from "lucide-react";
import { Fragment } from "react";

import type { Announcement } from "@/domain/announcement";
import { parseAnnouncementText } from "@/domain/announcementText";
import { cn } from "@d-party/ui";

import { useAnnouncements } from "./useAnnouncements";

const LEVEL_LABEL = { info: "お知らせ", warning: "重要なお知らせ" } as const;

export interface AnnouncementsProps {
  /** 配信中のアナウンスの取得。失敗しても空の配列で解決すること。 */
  load: () => Promise<Announcement[]>;
  /** 行の外側の余白。閉じたときに余白ごと畳む。 */
  itemClassName?: string;
}

/**
 * 配信中のアナウンスのうち、閉じていない一番新しい 1 件だけを控えめなテキスト行で出す
 * （ポップアップはタブの上、サイドバーはヘッダーの下）。× で閉じると、畳み終えてから次に
 * 新しいものが出る。何も無いとき・取得に失敗したときは何も描かない。
 */
export function Announcements({
  load,
  itemClassName,
}: AnnouncementsProps): React.JSX.Element {
  const { announcement, dismiss } = useAnnouncements(load);
  const reduce = useReducedMotion();
  return (
    // 入れ替わりで 2 行が同時に見えないよう、前の行を畳み終えてから次を出す。
    <AnimatePresence initial={false} mode="wait">
      {announcement && (
        <motion.div
          key={announcement.id}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={
            reduce ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }
          }
          className={cn("shrink-0 overflow-hidden", itemClassName)}
        >
          <AnnouncementRow
            announcement={announcement}
            onDismiss={() => dismiss(announcement.id)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 1 件 = 1 行（下線で区切る）。お知らせは小さな点 ＋ 灰色の文字。重要は見落とされないよう、
 * 色だけに頼らず、点の代わりに三角の警告アイコンを置き、本文の頭に「重要」と書き、本文を
 * 灰色ではなく通常の文字色にする。
 */
function AnnouncementRow({
  announcement: { message, level },
  onDismiss,
}: {
  announcement: Announcement;
  onDismiss: () => void;
}): React.JSX.Element {
  const warning = level === "warning";
  return (
    <div
      role="note"
      aria-label={LEVEL_LABEL[level]}
      className="flex items-start gap-2 border-b border-border py-2 text-xs leading-relaxed"
    >
      {/* 1 行目の高さに合わせて中央に置く（本文が折り返しても先頭行にそろう）。 */}
      <span
        className="flex h-[1.625em] w-3.5 shrink-0 items-center justify-center"
        aria-hidden
      >
        {warning ? (
          <TriangleExclamationPoint className="size-3.5 text-amber-600 dark:text-amber-400" />
        ) : (
          <span className="size-1.5 rounded-full bg-primary" />
        )}
      </span>
      <p
        className={cn(
          "min-w-0 flex-1 break-words",
          warning ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {warning && (
          <span className="mr-1.5 font-bold text-amber-700 dark:text-amber-400">
            重要
          </span>
        )}
        <AnnouncementText message={message} />
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="このお知らせを閉じる"
        title="閉じる（次からは表示しません）"
        className="-my-0.5 shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/**
 * 本文。`[テキスト](https://…)` だけをリンク（新しいタブで開く）にし、ほかは文字のまま出す。
 * HTML としては扱わず、React のテキストと `<a>` で組む（`domain/announcementText.ts`）。
 */
function AnnouncementText({ message }: { message: string }): React.JSX.Element {
  return (
    <>
      {parseAnnouncementText(message).map((segment, index) =>
        segment.kind === "link" ? (
          <a
            // 本文が変わらない限り並びは変わらないので、位置をキーにしてよい。
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-primary underline decoration-primary/60 underline-offset-2 transition-colors hover:decoration-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {segment.text}
          </a>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}
