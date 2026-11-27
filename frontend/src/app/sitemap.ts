import type { MetadataRoute } from "next";

import { SITE_URL } from "@/infrastructure/env";

/** 検索に載せる公開ページ。ルームごとのロビーは載せない。 */
const PUBLIC_PATHS = ["/", "/usage", "/qa", "/stats", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));
}
