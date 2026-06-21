import type { ImageResponse } from "next/og";

import { OG_SIZE } from "@/components/og/RoomOgImage";
import { OG_ALT, renderRoomImage } from "@/lib/og/renderRoomImage";

// Reuses the same card as the Open Graph image for the Twitter/X
// summary_large_image card. Kept as its own file because Next requires the
// route config (`runtime`/`size`/...) to be static literals per file.
export const runtime = "nodejs";

export const alt = OG_ALT;
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
