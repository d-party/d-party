/**
 * Open Graph card of a room — the title of the work being watched together.
 *
 * Rasterized to PNG per request by
 * `app/anime-store/lobby/[roomId]/{opengraph,twitter}-image.tsx`, and
 * previewable as HTML in Storybook (`RoomOgImage.stories.tsx`). See
 * {@link OgCard} for the Satori constraints.
 */

import { OgCard } from "@/components/og/OgCard";

export interface RoomOgImageProps {
  /**
   * Raw title as captured by the extension, e.g.
   * `"作品名 - 第1話 - サブタイトル"`. May be empty for rooms created by older
   * extension versions; a generic headline is shown in that case.
   */
  title?: string;
}

/** Split the extension's `"work - episode - subtitle"` title into work + the rest. */
function splitTitle(title: string): { work: string; sub: string } {
  const parts = title
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { work: "", sub: "" };
  return { work: parts[0], sub: parts.slice(1).join("　") };
}

export function RoomOgImage({
  title = "",
}: RoomOgImageProps): React.JSX.Element {
  const { work, sub } = splitTitle(title.trim());
  const hasTitle = work.length > 0;

  return (
    <OgCard
      eyebrow={hasTitle ? "この作品を一緒に視聴中" : "dアニメストアで同時視聴"}
      headline={hasTitle ? work : "友だちと、同じ瞬間を。"}
      sub={hasTitle && sub.length > 0 ? sub : undefined}
      headlineSize={hasTitle ? 76 : 64}
    />
  );
}
