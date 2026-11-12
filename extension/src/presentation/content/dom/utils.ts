
/** `name` goes into a regular expression, so every metacharacter is escaped. */
export function getParam(name: string, url: string = window.location.href): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp("[?&]" + escaped + "(=([^&#]*)|&|#|$)");
  const results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return "";
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

/**
 * Resolve `value` against `base`; null unless it is http(s). Values from the
 * page's DOM are untrusted, and a `javascript:` URL would run in the page.
 */
export function toHttpUrl(value: string, base: string = window.location.href): string | null {
  try {
    const url = new URL(value, base);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function makeFontFace(): void {
  const link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("type", "text/css");
  link.setAttribute("href", "https://fonts.googleapis.com/icon?family=Material+Icons");
  document.head.appendChild(link);
}

/** Inclusive. */

export function getRandomIntInclusive(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}
