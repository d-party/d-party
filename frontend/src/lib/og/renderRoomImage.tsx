import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { OG_SIZE, RoomOgImage } from "@/components/og/RoomOgImage";
import { resolveRoom } from "@/infrastructure/lobby";

/** Shared `alt` text for the room OG / Twitter images. */
export const OG_ALT = "d-party — dアニメストア・DMM TV で同時視聴";

const FONT_FAMILY = "Noto Sans JP";

// Noto Sans JP weights are bundled in the repo (`public/fonts/`) and read from
// disk, so the OG image needs no request-time fetch to Google Fonts. The full
// JP glyph set is embedded, so arbitrary anime titles render without tofu.
// `public/` is copied into the standalone runtime image, so `process.cwd()`
// resolves correctly in dev, `next start`, and the Docker container alike.
const FONT_DIR = join(process.cwd(), "public", "fonts");

/**
 * Load the bundled Noto Sans JP weights. Returns `[]` on failure so the image
 * still renders (Latin text via the default font) instead of 500-ing the route.
 */
async function loadFonts() {
  try {
    const [regular, bold] = await Promise.all([
      readFile(join(FONT_DIR, "NotoSansJP-Regular.ttf")),
      readFile(join(FONT_DIR, "NotoSansJP-Bold.ttf")),
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
  const fonts = await loadFonts();

  return new ImageResponse(<RoomOgImage title={title} />, {
    ...OG_SIZE,
    fonts,
  });
}
