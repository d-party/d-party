import type { ImageResponse } from "next/og";

import { OG_SIZE, SITE_OG_ALT } from "@/lib/og/card";
import { renderSiteImage } from "@/lib/og/renderSiteImage";

// Reads the bundled Japanese font from disk and rasterizes with Satori, so it
// needs Node's runtime. No request data → Next renders it once at build time.
export const runtime = "nodejs";

export const alt = SITE_OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * Site-wide Open Graph image. Applies to every route under `app/` that does not
 * define its own; the room lobby overrides it with a per-room card.
 */
export default async function Image(): Promise<ImageResponse> {
  return renderSiteImage();
}
