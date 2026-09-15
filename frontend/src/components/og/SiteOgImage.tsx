/**
 * Site-wide Open Graph card — shown for every page that does not ship its own
 * (landing, 使い方, Q&A, 統計, プライバシーポリシー, 404).
 *
 * Rasterized to PNG at build time by `app/opengraph-image.tsx` /
 * `app/twitter-image.tsx`, and previewable as HTML in Storybook
 * (`SiteOgImage.stories.tsx`). See {@link OgCard} for the Satori constraints.
 */

import { OgCard } from "@/components/og/OgCard";

export function SiteOgImage(): React.JSX.Element {
  return (
    <OgCard
      eyebrow="dアニメストアで同時視聴"
      headline="友だちと、同じ瞬間を。"
      sub="再生・一時停止・シークが自動で同期。完全無料の Chrome 拡張機能。"
      headlineSize={64}
    />
  );
}
