import type { ImageResponse } from "next/og";

import { OG_SIZE, SITE_OG_ALT } from "@/lib/og/card";
import { renderSiteImage } from "@/lib/og/renderSiteImage";

// Same card as the OG image. Next needs the route config as literals per file.

export const runtime = "nodejs";

export const alt = SITE_OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image(): Promise<ImageResponse> {
  return renderSiteImage();
}
