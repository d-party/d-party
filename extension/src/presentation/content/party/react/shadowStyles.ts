/** Built by the `sidebar-style` rspack entry and listed in `web_accessible_resources`. */
const SHADOW_STYLE_PATH = "js/sidebar-style.css";

let cssText: Promise<string> | null = null;

function loadCss(): Promise<string> {
  cssText ??= fetch(chrome.runtime.getURL(SHADOW_STYLE_PATH)).then(
    (response) => response.text(),
  );
  return cssText;
}

/**
 * Tailwind for a shadow root. A `<style>` per root rather than a shared
 * constructable stylesheet: the text is fetched once, and nothing depends on
 * `adoptedStyleSheets` working from a content script's isolated world.
 */
export function attachShadowStyles(shadow: ShadowRoot): void {
  const style = document.createElement("style");
  shadow.appendChild(style);
  loadCss().then(
    (css) => {
      style.textContent = css;
    },
    () => undefined,
  );
}
