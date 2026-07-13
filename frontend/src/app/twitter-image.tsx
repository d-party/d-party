import type { ImageResponse } from "next/og";

import { OG_SIZE, SITE_OG_ALT } from "@/lib/og/card";
import { renderSiteImage } from "@/lib/og/renderSiteImage";

// Reuses the same card as the Open Graph image for the Twitter/X
// summary_large_image card. Kept as its own file because Next requires the
// route config (`runtime`/`size`/...) to be static literals per file.
export const runtime = "nodejs";

export const alt = SITE_OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image(): Promise<ImageResponse> {
  return renderSiteImage();
}
