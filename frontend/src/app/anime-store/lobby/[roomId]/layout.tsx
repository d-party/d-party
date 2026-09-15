import type { Metadata } from "next";

import { resolveRoom } from "@/infrastructure/lobby";

/**
 * Per-room metadata for the lobby link (title, description, Open Graph and
 * Twitter card). The `opengraph-image.tsx` / `twitter-image.tsx` files in this
 * segment are picked up automatically by Next and injected as the og/twitter
 * images, so only the textual meta is set here.
 *
 * The lobby page itself is a client component, so this server layout is what
 * carries the metadata for the route.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const { title } = await resolveRoom(roomId);

  const pageTitle = title
    ? `${title} を一緒に視聴`
    : "ルームに参加して同時視聴";
  const description = title
    ? `「${title}」をdアニメストアで友だちと同時視聴。リンクを開いてルームに参加しよう。`
    : "dアニメストアで友だちと同時視聴。リンクを開いてルームに参加しよう。";

  return {
    title: pageTitle,
    description,
    // ルーム URL は短命・共有限定なので検索エンジンには載せない。
    robots: { index: false, follow: false },
    openGraph: {
      title: pageTitle,
      description,
      type: "website",
      siteName: "d-party",
      locale: "ja_JP",
      url: `/anime-store/lobby/${roomId}`,
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
    },
  };
}

export default function LobbyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
  return <>{children}</>;
}
