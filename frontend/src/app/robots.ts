import type { MetadataRoute } from "next";

import { SITE_URL } from "@/infrastructure/env";

/** ロビーは `noindex` のメタで外す。ここで disallow すると、そのメタが読まれなくなる。 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL("/sitemap.xml", SITE_URL).toString(),
  };
}
