import { OgCard } from "@/components/og/OgCard";

export interface RoomOgImageProps {
  /** As sent by the extension, e.g. `"作品名 - 第1話 - サブタイトル"`. May be empty. */
  title: string;
}

function splitTitle(title: string): { work: string; sub: string } {
  const parts = title
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);
  return { work: parts[0] ?? "", sub: parts.slice(1).join("　") };
}

/** OG card of a room: the title of the work being watched. */
export function RoomOgImage({ title }: RoomOgImageProps): React.JSX.Element {
  const { work, sub } = splitTitle(title);
  const hasTitle = work.length > 0;

  return (
    <OgCard
      eyebrow={hasTitle ? "この作品を一緒に視聴中" : "dアニメストアで同時視聴"}
      headline={hasTitle ? work : "友だちと、同じ瞬間を。"}
      sub={sub}
      headlineSize={hasTitle ? 76 : 64}
    />
  );
}
