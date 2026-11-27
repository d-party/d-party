import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { OG_FONT_FAMILY } from "@/lib/og/card";
import {
  type Coverage,
  fontCoverage,
  intersect,
  ogSafeTitle,
} from "@/lib/og/glyphs";

// Noto Sans JP weights are bundled in the repo (`public/fonts/`) and read from
// disk. The JP glyph set covers anime titles; characters outside it are dropped
// by `ogSafeTitle`, so the OG images never make a request-time fetch to Google
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

interface FontBytes {
  regular: Buffer;
  bold: Buffer;
  /** Code points both weights can draw. */
  coverage: Coverage;
}

/** The bundled fonts are there but cannot be used: a deploy bug, not retried. */
class UnusableFontsError extends Error {}

async function readFontBytes(): Promise<FontBytes> {
  const [regular, bold] = await Promise.all([
    readFile(join(FONT_DIR, "NotoSansJP-Regular.ttf")),
    readFile(join(FONT_DIR, "NotoSansJP-Bold.ttf")),
  ]);
  const coverage = intersect(fontCoverage(regular), fontCoverage(bold));
  if (coverage.length === 0) {
    throw new UnusableFontsError("OG fonts: no readable cmap");
  }
  return { regular, bold, coverage };
}

// The files are read (and their cmap parsed) once. A read error is retried on
// the next call; unusable fonts are not (re-reading 11 MB per request would not
// help). Without the fonts the card is not drawn at all: next/og's default font
// lacks the card's Japanese strings and would fetch fonts for them on every
// request, adding them to a loader that is never freed.
let bytesPromise: Promise<FontBytes> | null = null;

function loadFontBytes(): Promise<FontBytes> {
  bytesPromise ??= readFontBytes().catch((error: unknown) => {
    if (!(error instanceof UnusableFontsError)) bytesPromise = null;
    throw error;
  });
  return bytesPromise;
}

// Satori caches each parsed font in a WeakMap keyed by its `data` Buffer, and
// the parsed font caches every glyph it has drawn, for good. Reusing one Buffer
// saves re-parsing ~11 MB of CJK fonts per request, but lets the glyph cache
// grow with every distinct character any room title has used. So the same
// bytes are handed out under a new Buffer (a new cache key) once this many
// distinct characters have been drawn; the old parse is then garbage.
// About 40 KB per character over both weights, so roughly 60 MB at most.
const GLYPH_BUDGET = 1500;

let generation: [Buffer, Buffer] | null = null;
let drawn = new Set<number>();

function buffersFor(bytes: FontBytes, text: string): [Buffer, Buffer] {
  const next = new Set(drawn);
  for (const char of text) next.add(char.codePointAt(0)!);
  if (!generation || next.size > GLYPH_BUDGET) {
    const view = (b: Buffer) =>
      Buffer.from(b.buffer, b.byteOffset, b.byteLength);
    generation = [view(bytes.regular), view(bytes.bold)];
    drawn = new Set([...text].map((char) => char.codePointAt(0)!));
  } else {
    drawn = next;
  }
  return generation;
}

export interface OgCardFonts {
  /** For `ImageResponse`. */
  fonts: OgFont[];
  /** The room title, cut down to what `fonts` can draw (see `ogSafeTitle`). */
  title: string;
}

/**
 * Fonts for one card, and `title` made safe to draw with them. Anything a user
 * can set must go through here, or next/og fetches fonts for it and keeps them.
 * Rejects when the bundled fonts cannot be read (the route answers 500).
 */
export async function loadOgCardFonts(title = ""): Promise<OgCardFonts> {
  const bytes = await loadFontBytes();
  const safe = ogSafeTitle(title, bytes.coverage);
  const [regular, bold] = buffersFor(bytes, safe);
  return {
    // A new array every time: satori keys its font loader by the array and
    // appends fallback fonts to it, so one long-lived array would only grow.
    fonts: [
      { name: OG_FONT_FAMILY, data: regular, weight: 400, style: "normal" },
      { name: OG_FONT_FAMILY, data: bold, weight: 700, style: "normal" },
    ],
    title: safe,
  };
}
