import type { Metadata } from "next";

import {
  OG_SIZE,
  SITE_OG_ALT,
  SITE_OG_IMAGE_PATH,
  SITE_TWITTER_IMAGE_PATH,
} from "@/lib/og/card";

export const SITE_NAME = "d-party";

export const SITE_DESCRIPTION =
  "dアニメストアでもウォッチパーティーができる、完全無料の Google Chrome 向け拡張機能 d-party。";

/** `openGraph` fields every page shares. */
export const OPEN_GRAPH_BASE = {
  siteName: SITE_NAME,
  type: "website",
  locale: "ja_JP",
} as const;

/**
 * A page's own `openGraph` replaces the inherited one, image included, so every
 * page has to name the shared card explicitly.
 */
const SITE_OG_IMAGE = {
  url: SITE_OG_IMAGE_PATH,
  width: OG_SIZE.width,
  height: OG_SIZE.height,
  alt: SITE_OG_ALT,
} as const;

const SITE_TWITTER_IMAGE = { ...SITE_OG_IMAGE, url: SITE_TWITTER_IMAGE_PATH };

export interface PageMetadataInput {
  /** e.g. `"/usage"`. Used for `og:url` and the canonical URL. */
  path: string;
  /** Without the `| d-party` suffix. */
  title: string;
  description: string;
  /** `title` already contains the brand; skip the `%s | d-party` template. */
  titleIsBranded?: boolean;
}

/** For public pages. The room lobby has its own (`app/anime-store/lobby/[roomId]/page.tsx`). */
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
      ...OPEN_GRAPH_BASE,
      title: socialTitle,
      description,
      url: path,
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
