import { Suspense } from "react";
import type { Metadata } from "next";

import { LobbySpinner, LobbyView } from "@/components/lobby/LobbyView";
import { resolveRoomTitle } from "@/infrastructure/lobby";
import { lobbyPath } from "@/lib/links";
import { OPEN_GRAPH_BASE } from "@/lib/metadata";

type Props = { params: Promise<{ roomId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
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
      ...OPEN_GRAPH_BASE,
      title: pageTitle,
      description,
      url: lobbyPath(roomId),
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description,
    },
  };
}

export default async function LobbyPage({
  params,
}: Props): Promise<React.JSX.Element> {
  const { roomId } = await params;
  return (
    // LobbyView が useSearchParams を使うので Suspense が要る。
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <LobbySpinner />
        </div>
      }
    >
      <LobbyView roomId={roomId} />
    </Suspense>
  );
}
