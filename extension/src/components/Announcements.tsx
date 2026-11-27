import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Megaphone, TriangleExclamationPoint, X } from "lucide-react";

import type { Announcement } from "@/domain/announcement";
import { cn } from "@d-party/ui";

import { useAnnouncements } from "./useAnnouncements";

const LEVEL_LABEL = { info: "お知らせ", warning: "重要なお知らせ" } as const;

export interface AnnouncementsProps {
  /** 配信中のアナウンスの取得。失敗しても空の配列で解決すること。 */
  load: () => Promise<Announcement[]>;
  /** 各行の外側の余白。最後の 1 件を閉じたときに余白ごと畳む。 */
  itemClassName?: string;
}

/**
 * 配信中のアナウンスをカードで出す（ポップアップはタブの上、サイドバーはヘッダーの下）。
 * 何も無いとき・取得に失敗したときは何も描かない。
 */
export function Announcements({
  load,
  itemClassName,
}: AnnouncementsProps): React.JSX.Element {
  const { announcements, dismiss } = useAnnouncements(load);
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {announcements.map((announcement) => (
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
          <AnnouncementCard
            announcement={announcement}
            onDismiss={() => dismiss(announcement.id)}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

/** 種別は色だけでなくアイコンでも区別する（重要は三角の警告、お知らせはメガホン）。 */
function AnnouncementCard({
  announcement: { message, level },
  onDismiss,
}: {
  announcement: Announcement;
  onDismiss: () => void;
}): React.JSX.Element {
  const warning = level === "warning";
  const Icon = warning ? TriangleExclamationPoint : Megaphone;
  return (
    <div
      role="note"
      aria-label={LEVEL_LABEL[level]}
      className={cn(
        "flex items-start gap-2 rounded-lg border py-2 pr-1.5 pl-3 text-xs leading-relaxed shadow-sm",
        warning
          ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
          : "border-border bg-card text-card-foreground",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          warning ? "text-amber-600 dark:text-amber-400" : "text-primary",
        )}
        aria-hidden
      />
      <p className="min-w-0 flex-1 break-words">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="このお知らせを閉じる"
        title="閉じる（次からは表示しません）"
        className="-my-0.5 shrink-0 rounded p-1 text-current/60 transition-colors hover:bg-black/5 hover:text-current dark:hover:bg-white/10"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
