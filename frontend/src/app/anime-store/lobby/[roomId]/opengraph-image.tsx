import type { ImageResponse } from "next/og";

import { OG_SIZE, ROOM_OG_ALT } from "@/lib/og/card";
import { renderRoomImage } from "@/lib/og/renderRoomImage";

// Node runtime: reads the room title and a font at request time.

export const runtime = "nodejs";

export const alt = ROOM_OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ roomId: string }>;
}): Promise<ImageResponse> {
  const { roomId } = await params;
  return renderRoomImage(roomId);
}
