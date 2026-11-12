import type { ImageResponse } from "next/og";

import { OG_SIZE, SITE_OG_ALT } from "@/lib/og/card";
import { renderSiteImage } from "@/lib/og/renderSiteImage";

// Node runtime (reads the font from disk). Rendered once at build time.
export const runtime = "nodejs";

export const alt = SITE_OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image(): Promise<ImageResponse> {
  return renderSiteImage();
}
