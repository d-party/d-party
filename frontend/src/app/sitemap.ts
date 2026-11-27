import type { MetadataRoute } from "next";

import { DOC_CHAPTERS, DOCS_PATH, docPath } from "@/components/docs/chapters";
import { SITE_URL } from "@/infrastructure/env";

/** 検索に載せる公開ページ。ルームごとのロビーは載せない。 */
const PUBLIC_PATHS = [
  "/",
  "/usage",
  DOCS_PATH,
  ...DOC_CHAPTERS.map((chapter) => docPath(chapter.slug)),
  "/qa",
  "/stats",
  "/privacy",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));
}
