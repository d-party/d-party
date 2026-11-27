import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";

import { type DocSlug, docPath, findChapter } from "./chapters";

export function docMetadata(slug: DocSlug): Metadata {
  const chapter = findChapter(slug);
  return pageMetadata({
    path: docPath(slug),
    title: `${chapter.title} - 利用マニュアル`,
    description: `d-party 利用マニュアル「${chapter.title}」。${chapter.description}`,
  });
}
