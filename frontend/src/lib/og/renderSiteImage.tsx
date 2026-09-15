import { ImageResponse } from "next/og";

import { SiteOgImage } from "@/components/og/SiteOgImage";
import { OG_SIZE } from "@/lib/og/card";
import { loadOgFonts } from "@/lib/og/fonts";

/**
 * Render the site-wide social card to a PNG. Shared by the root
 * `opengraph-image.tsx` / `twitter-image.tsx` (each keeps its own literal route
 * config; Next requires `runtime`/`size`/etc. to be static literals per file,
 * so only the render logic is shared here). Depends on no request data, so Next
 * rasterizes it once at build time and serves it statically.
 */
export async function renderSiteImage(): Promise<ImageResponse> {
  const fonts = await loadOgFonts();

  return new ImageResponse(<SiteOgImage />, { ...OG_SIZE, fonts });
}
