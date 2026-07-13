import { ImageResponse } from "next/og";

import { RoomOgImage } from "@/components/og/RoomOgImage";
import { resolveRoom } from "@/infrastructure/lobby";
import { OG_SIZE } from "@/lib/og/card";
import { loadOgFonts } from "@/lib/og/fonts";

/**
 * Render a room's social card to a PNG. Shared by `opengraph-image.tsx` and
 * `twitter-image.tsx` (each keeps its own literal route config; Next requires
 * `runtime`/`size`/etc. to be static literals per file, so only the render
 * logic is shared here).
 */
export async function renderRoomImage(roomId: string): Promise<ImageResponse> {
  const { title } = await resolveRoom(roomId);
  const fonts = await loadOgFonts();

  return new ImageResponse(<RoomOgImage title={title} />, {
    ...OG_SIZE,
    fonts,
  });
}
