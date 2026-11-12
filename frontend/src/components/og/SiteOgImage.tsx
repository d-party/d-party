/** OG card for every page except the room lobby. */

import { OgCard } from "@/components/og/OgCard";

export function SiteOgImage(): React.JSX.Element {
  return (
    <OgCard
      eyebrow="dアニメストア・DMM TV で同時視聴"
      headline="友だちと、同じ瞬間を。"
      sub="再生・一時停止・シークが自動で同期。完全無料の Chrome 拡張機能。"
      headlineSize={64}
    />
  );
}
