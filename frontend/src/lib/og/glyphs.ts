/**
 * Which code points a TrueType / OpenType font can draw, read from its `cmap`.
 *
 * `next/og` fetches a font from Google Fonts for every character the given
 * fonts lack, and keeps each result in a module-level cache that is never
 * evicted, keyed by the missing characters. Room titles are set by anyone who
 * opens a room, so the cards drop such characters instead (see `ogSafeTitle`).
 *
 * No imports, so the module also runs under plain Node for a quick check.
 */

/** Sorted, non-overlapping, inclusive `[first, last]` code point ranges. */
export type Coverage = ReadonlyArray<readonly [number, number]>;

function tag(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

function merge(ranges: [number, number][]): Coverage {
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [first, last] of ranges) {
    const prev = merged.at(-1);
    if (prev && first <= prev[1] + 1) prev[1] = Math.max(prev[1], last);
    else merged.push([first, last]);
  }
  return merged;
}

// Format 12: segmented coverage (all of Unicode). A group whose first glyph is
// 0 maps its first code point to .notdef, which counts as missing.
function readFormat12(view: DataView, at: number): Coverage {
  const groups = view.getUint32(at + 12);
  const ranges: [number, number][] = [];
  for (let i = 0; i < groups; i++) {
    const g = at + 16 + i * 12;
    const first = view.getUint32(g) + (view.getUint32(g + 8) === 0 ? 1 : 0);
    const last = view.getUint32(g + 4);
    if (first <= last) ranges.push([first, last]);
  }
  return merge(ranges);
}

// Format 4: segment mapping to delta values (the BMP). Glyph 0 means "missing".
function readFormat4(view: DataView, at: number): Coverage {
  const segCount = view.getUint16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segCount * 2 + 2;
  const deltas = starts + segCount * 2;
  const rangeOffsets = deltas + segCount * 2;
  const ranges: [number, number][] = [];
  for (let i = 0; i < segCount; i++) {
    const start = view.getUint16(starts + i * 2);
    const end = view.getUint16(ends + i * 2);
    const delta = view.getInt16(deltas + i * 2);
    const rangeOffsetAt = rangeOffsets + i * 2;
    const rangeOffset = view.getUint16(rangeOffsetAt);
    for (let c = start; c <= end && c !== 0xffff; c++) {
      let glyph: number;
      if (rangeOffset === 0) {
        glyph = (c + delta) & 0xffff;
      } else {
        glyph = view.getUint16(rangeOffsetAt + rangeOffset + (c - start) * 2);
        if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
      }
      if (glyph !== 0) ranges.push([c, c]);
    }
  }
  return merge(ranges);
}

// The subtable opentype.js (inside satori) uses: the last Unicode record.
function isUnicode(platform: number, encoding: number): boolean {
  return (
    (platform === 3 && (encoding === 0 || encoding === 1 || encoding === 10)) ||
    (platform === 0 && encoding <= 4)
  );
}

/** Code points `data` (a TTF / OTF file) maps to a glyph. Empty if unreadable. */
export function fontCoverage(data: Uint8Array): Coverage {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const numTables = view.getUint16(4);
    let cmap = -1;
    for (let i = 0; i < numTables; i++) {
      const record = 12 + i * 16;
      if (tag(view, record) === "cmap") cmap = view.getUint32(record + 8);
    }
    if (cmap < 0) return [];

    const subtables = view.getUint16(cmap + 2);
    for (let i = subtables - 1; i >= 0; i--) {
      const record = cmap + 4 + i * 8;
      if (!isUnicode(view.getUint16(record), view.getUint16(record + 2))) {
        continue;
      }
      const at = cmap + view.getUint32(record + 4);
      const format = view.getUint16(at);
      if (format === 12) return readFormat12(view, at);
      if (format === 4) return readFormat4(view, at);
      return [];
    }
    return [];
  } catch {
    return [];
  }
}

/** Code points both coverages contain. */
export function intersect(a: Coverage, b: Coverage): Coverage {
  const out: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const first = Math.max(a[i]![0], b[j]![0]);
    const last = Math.min(a[i]![1], b[j]![1]);
    if (first <= last) out.push([first, last]);
    if (a[i]![1] < b[j]![1]) i++;
    else j++;
  }
  return out;
}

export function covers(coverage: Coverage, codePoint: number): boolean {
  let lo = 0;
  let hi = coverage.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [first, last] = coverage[mid]!;
    if (codePoint < first) hi = mid - 1;
    else if (codePoint > last) lo = mid + 1;
    else return true;
  }
  return false;
}

/** `text` (NFC) without the code points `coverage` lacks. */
export function keepCovered(text: string, coverage: Coverage): string {
  let kept = "";
  for (const char of text.normalize("NFC")) {
    if (covers(coverage, char.codePointAt(0)!)) kept += char;
  }
  return kept;
}

// A room card shows at most ~40 characters of the work and ~55 of the rest.
// Every character is still laid out (and its glyph loaded) even when clipped.
const PART_MAX_CHARS = 60;
const MAX_PARTS = 4;

/**
 * A room title (`"作品名 - 第1話 - サブタイトル"`) the card can draw: each part
 * cut to what the card shows, without what `coverage` lacks. `""` (the generic
 * card) when the work part has nothing left, so an episode never becomes the
 * headline.
 */
export function ogSafeTitle(title: string, coverage: Coverage): string {
  const parts = title
    .split(" - ")
    .slice(0, MAX_PARTS)
    .map((part) =>
      keepCovered(
        [...part.trim()].slice(0, PART_MAX_CHARS).join(""),
        coverage,
      ).trim(),
    );
  if (!parts[0]) return "";
  return parts.filter(Boolean).join(" - ");
}
