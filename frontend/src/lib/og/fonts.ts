import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { OG_FONT_FAMILY } from "@/lib/og/card";
import { type Coverage, fontCoverage, keepCovered } from "@/lib/og/glyphs";

// Noto Sans JP weights are bundled in the repo (`public/fonts/`) and read from
// disk. The JP glyph set covers anime titles; characters outside it are dropped
// by `ogSafeText`, so the OG images never make a request-time fetch to Google
// Fonts. `public/` is copied into the standalone runtime image, so
// `process.cwd()` resolves correctly in dev, `next start`, and the Docker
// container alike.
const FONT_DIR = join(process.cwd(), "public", "fonts");

interface OgFont {
  name: string;
  data: Buffer;
  weight: 400 | 700;
  style: "normal";
}

async function readOgFonts(): Promise<OgFont[]> {
  try {
    const [regular, bold] = await Promise.all([
      readFile(join(FONT_DIR, "NotoSansJP-Regular.ttf")),
      readFile(join(FONT_DIR, "NotoSansJP-Bold.ttf")),
    ]);
    return [
      { name: OG_FONT_FAMILY, data: regular, weight: 400, style: "normal" },
      { name: OG_FONT_FAMILY, data: bold, weight: 700, style: "normal" },
    ];
  } catch {
    return [];
  }
}

// The same array (and Buffers) on every call. Satori caches parsed fonts in
// WeakMaps keyed by them, so fresh objects per request would re-read and
// re-parse ~11 MB of CJK fonts each time, which the OG routes cannot afford
// (they are public and the frontend pod is small).
let fontsPromise: Promise<OgFont[]> | null = null;

/**
 * Load the bundled Noto Sans JP weights for `next/og`. Returns `[]` on failure
 * so the image still renders (Latin text via the default font) instead of
 * 500-ing the route; a failure is retried on the next call.
 */
export function loadOgFonts(): Promise<OgFont[]> {
  fontsPromise ??= readOgFonts().then((fonts) => {
    if (fonts.length === 0) fontsPromise = null;
    return fonts;
  });
  return fontsPromise;
}

const coverages = new WeakMap<Buffer, Coverage>();

// Without the bundled fonts, `next/og` draws only printable ASCII by itself.
const ASCII: Coverage = [[0x20, 0x7e]];

/**
 * `text` without the characters the OG fonts cannot draw, so `next/og` has
 * nothing to fetch for it. Use it on anything a user can set (room titles).
 */
export function ogSafeText(text: string, fonts: readonly OgFont[]): string {
  const data = fonts[0]?.data;
  if (!data) return keepCovered(text, ASCII);
  let coverage = coverages.get(data);
  if (!coverage) {
    coverage = fontCoverage(data);
    coverages.set(data, coverage);
  }
  return keepCovered(text, coverage);
}
