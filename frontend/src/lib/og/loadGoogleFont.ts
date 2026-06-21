/**
 * Fetch a (subsetted) Google Font as an ArrayBuffer for use with `next/og`'s
 * `ImageResponse` (`@vercel/og` / Satori).
 *
 * Satori has no built-in CJK glyphs, so Japanese anime titles would render as
 * tofu (□) without an embedded font. We request only the glyphs actually used
 * (`text`) to keep the download tiny. Omitting a modern User-Agent makes Google
 * return a TrueType file, which Satori can parse (woff2 cannot be used).
 */
export async function loadGoogleFont(
  family: string,
  weight: number,
  text: string,
): Promise<ArrayBuffer> {
  const params = new URLSearchParams({
    family: `${family}:wght@${weight}`,
    text,
  });
  const cssUrl = `https://fonts.googleapis.com/css2?${params.toString()}`;
  const css = await fetch(cssUrl).then((res) => res.text());
  const url = css.match(
    /src: url\((.+?)\) format\('(?:opentype|truetype)'\)/,
  )?.[1];
  if (!url) {
    throw new Error(`Failed to resolve font URL for ${family} (${weight})`);
  }
  return fetch(url).then((res) => res.arrayBuffer());
}
