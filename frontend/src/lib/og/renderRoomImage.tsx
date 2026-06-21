import { ImageResponse } from "next/og";

import { OG_SIZE, RoomOgImage } from "@/components/og/RoomOgImage";
import { resolveRoom } from "@/infrastructure/lobby";
import { loadGoogleFont } from "@/lib/og/loadGoogleFont";

/** Shared `alt` text for the room OG / Twitter images. */
export const OG_ALT = "d-party — dアニメストアで同時視聴";

// Static copy baked into the image; included in the font subset request so all
// glyphs (kana/kanji) are available to Satori.
const STATIC_GLYPHS =
  "d-party WATCH PARTY この作品を一緒に視聴中 dアニメストアで同時視聴 友だちと、同じ瞬間を。 dアニメストアを友だちと同時視聴 d-party.net ▶";

const FONT_FAMILY = "Noto Sans JP";

/**
 * Load the Noto Sans JP weights needed for the image, subsetted to the glyphs
 * actually rendered. Returns `[]` on failure so the image still renders (Latin
 * text via the default font) instead of 500-ing the route.
 */
async function loadFonts(text: string) {
  try {
    const [regular, bold] = await Promise.all([
      loadGoogleFont(FONT_FAMILY, 400, text),
      loadGoogleFont(FONT_FAMILY, 700, text),
    ]);
    return [
      {
        name: FONT_FAMILY,
        data: regular,
        weight: 400 as const,
        style: "normal" as const,
      },
      {
        name: FONT_FAMILY,
        data: bold,
        weight: 700 as const,
        style: "normal" as const,
      },
    ];
  } catch {
    return [];
  }
}

/**
 * Render a room's social card to a PNG. Shared by `opengraph-image.tsx` and
 * `twitter-image.tsx` (each keeps its own literal route config; Next requires
 * `runtime`/`size`/etc. to be static literals per file, so only the render
 * logic is shared here).
 */
export async function renderRoomImage(roomId: string): Promise<ImageResponse> {
  const { title } = await resolveRoom(roomId);
  const fonts = await loadFonts(`${STATIC_GLYPHS} ${title}`);

  return new ImageResponse(<RoomOgImage title={title} />, {
    ...OG_SIZE,
    fonts,
  });
}
