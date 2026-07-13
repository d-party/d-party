import { readFile } from "node:fs/promises";
import { join } from "node:path";

const FONT_FAMILY = "Noto Sans JP";

// Noto Sans JP weights are bundled in the repo (`public/fonts/`) and read from
// disk, so the OG images need no request-time fetch to Google Fonts. The full
// JP glyph set is embedded, so arbitrary anime titles render without tofu.
// `public/` is copied into the standalone runtime image, so `process.cwd()`
// resolves correctly in dev, `next start`, and the Docker container alike.
const FONT_DIR = join(process.cwd(), "public", "fonts");

export interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

/**
 * Load the bundled Noto Sans JP weights for `next/og`. Returns `[]` on failure
 * so the image still renders (Latin text via the default font) instead of
 * 500-ing the route.
 */
export async function loadOgFonts(): Promise<OgFont[]> {
  try {
    const [regular, bold] = await Promise.all([
      readFile(join(FONT_DIR, "NotoSansJP-Regular.ttf")),
      readFile(join(FONT_DIR, "NotoSansJP-Bold.ttf")),
    ]);
    return [
      { name: FONT_FAMILY, data: regular, weight: 400, style: "normal" },
      { name: FONT_FAMILY, data: bold, weight: 700, style: "normal" },
    ];
  } catch {
    return [];
  }
}
