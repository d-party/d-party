import type { Metadata } from "next";

import { resolveRoomTitle } from "@/infrastructure/lobby";

/** Text metadata for the room. The page is a client component, so it lives here. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<Metadata> {
  const { roomId } = await params;
  const title = await resolveRoomTitle(roomId);

  const pageTitle = title
    ? `${title} を一緒に視聴`
    : "ルームに参加して同時視聴";
  const description = title
    ? `「${title}」をdアニメストアで友だちと同時視聴。リンクを開いてルームに参加しよう。`
    : "dアニメストアで友だちと同時視聴。リンクを開いてルームに参加しよう。";

  return {
    title: pageTitle,
    description,
    // ルーム URL は短命なので検索に載せない。

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
