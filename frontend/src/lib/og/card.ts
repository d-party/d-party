/** Plain values only (no `next/og`, no JSX), so Storybook can import them too. */

/** 1.91:1, as Open Graph / Twitter expect. */

export const OG_SIZE = { width: 1200, height: 630 } as const;

/** `alt` of the site-wide card. */
export const SITE_OG_ALT =
  "d-party — dアニメストアを友だちと同時視聴できる Chrome 拡張機能";

/** `alt` of a room's card. */
export const ROOM_OG_ALT = "d-party — dアニメストアで同時視聴";

/** Routes serving the site-wide card (the `app/` file conventions). */
export const SITE_OG_IMAGE_PATH = "/opengraph-image";
export const SITE_TWITTER_IMAGE_PATH = "/twitter-image";
