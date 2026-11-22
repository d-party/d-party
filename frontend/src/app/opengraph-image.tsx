import { ImageResponse } from "next/og";

import { SiteOgImage } from "@/components/og/SiteOgImage";
import { OG_SIZE, SITE_OG_ALT } from "@/lib/og/card";
import { loadOgFonts } from "@/lib/og/fonts";

export const alt = SITE_OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

/** Depends on no request data, so Next rasterizes it once at build time. */
export default async function Image(): Promise<ImageResponse> {
  return new ImageResponse(<SiteOgImage />, {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
  });
}
