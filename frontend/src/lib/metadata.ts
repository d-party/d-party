import type { Metadata } from "next";

import {
  OG_SIZE,
  SITE_OG_ALT,
  SITE_OG_IMAGE_PATH,
  SITE_TWITTER_IMAGE_PATH,
} from "@/lib/og/card";

const SITE_NAME = "d-party";

/**
 * The shared card, served by `app/opengraph-image.tsx` / `app/twitter-image.tsx`.
 *
 * Those file conventions already attach the image to any route that inherits the
 * root layout's `openGraph` as-is — but a page that declares its own `openGraph`
 * *replaces* the resolved one, image included. Every page here declares one (it
 * needs its own og:title/description), so the image has to be named explicitly.
 */
const SITE_OG_IMAGE = {
  url: SITE_OG_IMAGE_PATH,
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  alt: SITE_OG_ALT,
} as const;

const SITE_TWITTER_IMAGE = { ...SITE_OG_IMAGE, url: SITE_TWITTER_IMAGE_PATH };

export interface PageMetadataInput {
  /** Path of the page, e.g. `"/usage"`. Becomes `og:url` and the canonical URL. */
  path: string;
  /** `<title>` without the `| d-party` suffix — the root layout's template adds it. */
  title: string;
  /** `<meta name="description">`, also reused for `og:description` / Twitter. */
  description: string;
  /**
   * Set when `title` already carries the brand (the landing page): the `<title>`
   * is then used as-is instead of going through the `%s | d-party` template.
   */
  titleIsBranded?: boolean;
}

/**
 * Build the metadata for a public page: title, description, canonical URL, and
 * the Open Graph / Twitter card (per-page text on the shared site image).
 *
 * The room lobby does not use this: it renders a per-room card and stays out of
 * the index (see `app/anime-store/lobby/[roomId]/layout.tsx`).
 */
export function pageMetadata({
  path,
  title,
  description,
  titleIsBranded = false,
}: PageMetadataInput): Metadata {
  const socialTitle = titleIsBranded ? title : `${title} | ${SITE_NAME}`;

  return {
    title: titleIsBranded ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: socialTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      type: "website",
      locale: "ja_JP",
      images: [SITE_OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [SITE_TWITTER_IMAGE],
    },
  };
}
