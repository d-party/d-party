import { getParam, makeFontFace } from "../dom/utils";
import { ChromeStorageSettingsRepository } from "@/infrastructure/storage/ChromeStorageSettingsRepository";
import { DEFAULT_SETTINGS, type Settings } from "@/domain/settings";

/**
 * Episode-list pages (ci_pc / tp_pc): adds "open in another tab" and "create
 * party" icons to each episode, and decorates the episode detail modal.
 *
 * The buttons are an absolute overlay on the card (public/css/style.css). Do not
 * restyle the page's own list layout: it stretches the row and draws a line
 * between the thumbnail and its frame.
 */

const DECORATED_ATTR = "data-dparty-decorated";
const MODAL_DECORATED_ATTR = "data-dparty-modal-decorated";
const PLAYLINK_ATTR = "data-dparty-playlink";

const settingsRepo = new ChromeStorageSettingsRepository();
/** Kept in sync with chrome.storage and read at click time, so changes apply without reload. */
let currentSettings: Settings = DEFAULT_SETTINGS;

makeFontFace();
ready(main);
void loadSettings();

function main(): void {
  decorate();
  // The list (Swiper) and the modal change after load. decorate() skips done nodes.
  const observer = new MutationObserver(() => decorate());
  observer.observe(document.body, { childList: true, subtree: true });
}

function decorate(): void {
  decorateEpisodes();
  decorateModal();
  decoratePlaylinks();
}

async function loadSettings(): Promise<void> {
  currentSettings = await settingsRepo.getAll();
  decorate();
  settingsRepo.onChange((next) => {
    currentSettings = next;
    decorate();
  });
}

function decorateEpisodes(): void {
  const itemList = document.querySelectorAll<HTMLAnchorElement>(".itemModule.list a");

  for (const item of Array.from(itemList)) {
    const href = item.getAttribute("href");
    if (!href || !/cd_pc/.test(href)) continue;
    if (item.hasAttribute(DECORATED_ATTR)) continue;
    item.setAttribute(DECORATED_ATTR, "1");

    const partId = href.replace(/[^0-9]/g, "");
    if (item.classList.contains("watched")) {
      item.parentElement?.classList.add("watched_episode");
    }

    const overlay = document.createElement("div");
    overlay.className = "dparty-overlay";
    overlay.appendChild(
      createButton({
        icon: "play_circle_filled",
        variant: "play",
        tooltip: "別タブで再生",
        href: "sc_d_pc?partId=" + partId,
      }),
    );
    overlay.appendChild(
      createButton({
        icon: "groups",
        variant: "party",
        tooltip: "パーティールームを作成",
        href: "sc_d_pc?partId=" + partId + "&party=create",
      }),
    );
    item.parentElement?.appendChild(overlay);
  }
}

function createButton(opts: {
  icon: string;
  variant: "play" | "party";
  tooltip: string;
  href: string;
}): HTMLButtonElement {
  const url = new URL(opts.href, window.location.href).href;
  return iconButton({
    icon: opts.icon,
    className: `dparty-btn dparty-btn--${opts.variant}`,
    tooltip: opts.tooltip,
    onClick: () => window.open(url, "_blank", "noopener"),
  });
}

/**
 * A <button>, not an <a>: the page styles `.itemModule .list a` (underline,
 * `position`, click handlers) with rules that outrank ours.
 */
function iconButton(opts: {
  icon: string;
  className: string;
  tooltip: string;
  onClick: () => void;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = opts.className;
  button.setAttribute("aria-label", opts.tooltip);

  // Capture phase, so the page's own handlers never see the click.
  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideTooltip();
      opts.onClick();
    },
    true,
  );

  button.addEventListener("mouseenter", () => showTooltip(button, opts.tooltip));
  button.addEventListener("mouseleave", hideTooltip);
  button.addEventListener("focus", () => showTooltip(button, opts.tooltip));
  button.addEventListener("blur", hideTooltip);

  // Inner span keeps material-icons' font sizing off the button box.
  const glyph = document.createElement("span");
  glyph.className = "material-icons";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = opts.icon;
  button.appendChild(glyph);

  return button;
}

/**
 * One tooltip on document.body for every button. Inside the carousel it would be
 * clipped by overflow:hidden, and the wrapper's transform traps position:fixed.
 */
let tooltipEl: HTMLDivElement | null = null;

function showTooltip(target: HTMLElement, text: string): void {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "dparty-tooltip";
    document.body.appendChild(tooltipEl);
  }
  tooltipEl.textContent = text;
  const rect = target.getBoundingClientRect();
  tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
  tooltipEl.style.top = `${rect.top}px`;
  tooltipEl.classList.add("dparty-tooltip--visible");
}

function hideTooltip(): void {
  tooltipEl?.classList.remove("dparty-tooltip--visible");
}

/**
 * The detail modal's 視聴する button. With autoAnotherTab on it opens a new tab;
 * otherwise an extra "別タブで視聴する" button sits at its right edge.
 *
 * The extra button goes inside the 視聴する pill. As a direct child of
 * #streamingQuality (a flex list) it would count as an item and halve 視聴する.
 */
function decorateModal(): void {
  const quality = document.querySelector("#streamingQuality");
  const watchButton = quality?.querySelector<HTMLElement>("a.normal");
  if (!quality || !watchButton) return;

  if (!quality.hasAttribute(MODAL_DECORATED_ATTR)) {
    quality.setAttribute(MODAL_DECORATED_ATTR, "1");

    watchButton.addEventListener(
      "click",
      (event) => {
        if (!currentSettings.autoAnotherTab) return; // keep native inline play
        if (!openPlayerInNewTab()) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );

    const openButton = iconButton({
      icon: "open_in_new",
      className: "dparty-btn dparty-btn--play dparty-modal-open",
      tooltip: "別タブで視聴する",
      onClick: () => openPlayerInNewTab(),
    });
    watchButton.style.position = "relative";
    watchButton.appendChild(openButton);
  }

  const openButton = quality.querySelector(".dparty-modal-open");
  openButton?.classList.toggle("dparty-hidden", currentSettings.autoAnotherTab);
}

/**
 * With autoAnotherTab on, open inline-play links in a new tab. Both carry
 * `data-partid`: `a.playlink` (hover popups) and `a.directPlayReady` (the
 * "続きから視聴する" widget on tp_pc).
 */
function decoratePlaylinks(): void {
  const links = document.querySelectorAll<HTMLElement>(
    "a.playlink[data-partid], a.directPlayReady[data-partid]",
  );

  for (const link of Array.from(links)) {
    if (link.hasAttribute(PLAYLINK_ATTR)) continue;
    link.setAttribute(PLAYLINK_ATTR, "1");

    link.addEventListener(
      "click",
      (event) => {
        if (!currentSettings.autoAnotherTab) return; // keep native inline play
        const partId = link.getAttribute("data-partid");
        if (!partId) return;
        event.preventDefault();
        event.stopPropagation();
        const url = new URL("sc_d_pc?partId=" + partId, window.location.href).href;
        window.open(url, "_blank", "noopener");
      },
      true,
    );
  }
}

/** Returns false when the partId is unknown, so callers keep the native behavior. */
function openPlayerInNewTab(): boolean {
  const partId = currentPartId();
  if (!partId) return false;
  const url = new URL("sc_d_pc?partId=" + partId, window.location.href).href;
  window.open(url, "_blank", "noopener");
  return true;
}

/**
 * Read from the modal thumbnail (`.../28724001_1_1.png`) so it follows prev/next;
 * falls back to the page URL.
 */
function currentPartId(): string | null {
  const img = document.querySelector<HTMLImageElement>("#modalThumbImg");
  const src = img?.getAttribute("src") ?? img?.getAttribute("data-src") ?? "";
  const match = src.match(/\/(\d+)_\d+_\d+\.(?:png|jpe?g)/i);
  return match ? match[1] : getParam("partId");
}

/** Content scripts often start after `load`, so run now if it already fired. */

function ready(fn: () => void): void {
  if (document.readyState === "complete") {
    fn();
  } else {
    window.addEventListener("load", fn, false);
  }
}
