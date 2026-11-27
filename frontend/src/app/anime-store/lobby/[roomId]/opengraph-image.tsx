import { ImageResponse } from "next/og";

import { RoomOgImage } from "@/components/og/RoomOgImage";
import { resolveRoomTitle } from "@/infrastructure/lobby";
import { OG_SIZE, ROOM_OG_ALT } from "@/lib/og/card";
import { loadOgFonts, ogSafeText } from "@/lib/og/fonts";

export const alt = ROOM_OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<ImageResponse> {
  const { roomId } = await params;
  const [title, fonts] = await Promise.all([
    resolveRoomTitle(roomId),
    loadOgFonts(),
  ]);

  // The title is set by whoever opened the room, so drop what the fonts lack.
  return new ImageResponse(<RoomOgImage title={ogSafeText(title, fonts)} />, {
    ...OG_SIZE,
    fonts,
  });
}
