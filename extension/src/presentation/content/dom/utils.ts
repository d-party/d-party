/** DOM/URL helpers shared by the content scripts (port of the old utils.js). */

/**
 * Read a query-string parameter (defaults to the current page URL).
 *
 * `name` is interpolated into a regular expression, so every metacharacter has
 * to be escaped — not just the brackets. Escaping only `[` and `]` leaves a
 * backslash in `name` able to change the meaning of the pattern that follows it.
 */
export function getParam(name: string, url: string = window.location.href): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("[?&]" + escaped + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

/**
 * Resolve `value` against `base` and return it only when it navigates over
 * http(s).
 *
 * Used for values read out of the page's own DOM. Those are attacker-controlled
 * as far as the extension is concerned: a `javascript:` URL assigned to
 * `location.href` from a content script runs in the page, so the scheme has to
 * be checked before navigating. Returns `null` for anything else (including
 * unparsable input).
 */
export function toHttpUrl(value: string, base: string = window.location.href): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Inject the Material Icons stylesheet. */
export function makeFontFace(): void {
  const link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  link.setAttribute("href", "https://fonts.googleapis.com/icon?family=Material+Icons");
  document.head.appendChild(link);
}

/** Inclusive random integer in [min, max]. */
export function getRandomIntInclusive(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}
