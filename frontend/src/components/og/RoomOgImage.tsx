/**
 * Presentational layout for a room's Open Graph image (1200×630).
 *
 * Written with inline styles only, using the flexbox subset that Satori
 * (the engine behind `next/og`'s `ImageResponse`, i.e. `@vercel/og`) supports.
 * This lets the very same component be:
 *   - rendered to a PNG on the server by `opengraph-image.tsx` / `twitter-image.tsx`
 *   - previewed as plain HTML in Storybook (`RoomOgImage.stories.tsx`).
 *
 * Keep it free of Tailwind classes, external CSS and unsupported CSS features.
 */

import logoUrl from "@/components/logo-data";

export const OG_SIZE = { width: 1200, height: 630 } as const;

/**
 * Brand palette converted from the globals.css theme tokens (oklch) to hex so
 * Satori renders them reliably. `primary` is the d-party theme red
 * (`--primary: oklch(0.637 0.237 25.331)`), background/foreground/muted mirror
 * the dark theme — intentionally neutral (no magenta tint) with a red accent.
 */
const COLORS = {
  bgFrom: "#0d0e13", // --background
  bgTo: "#16171d", // slightly lifted neutral for subtle depth
  primary: "#fb2c36", // --primary (theme red)
  primaryRgb: "251, 44, 54", // primary as rgb for translucent glows/fills
  text: "#fafafa", // --foreground
  muted: "#a1a1a1", // --muted-foreground
} as const;

/**
 * The brand mark recolored to the theme red. The app icon is a red logo on a
 * black tile, so we keep that treatment here. The source SVG (logo-data.ts)
 * bakes its fill as `#cc0033`; swap it for the brighter theme red.
 */
const LOGO_RED = logoUrl.replace("%23cc0033", "%23fb2c36");

export interface RoomOgImageProps {
  /**
   * Raw title as captured by the extension, e.g.
   * `"作品名 - 第1話 - サブタイトル"`. May be empty for rooms created by older
   * extension versions; a generic headline is shown in that case.
   */
  title?: string;
}

/** Split the extension's `"work - episode - subtitle"` title into work + the rest. */
function splitTitle(title: string): { work: string; sub: string } {
  const parts = title
    .split(" - ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { work: "", sub: "" };
  return { work: parts[0], sub: parts.slice(1).join("　") };
}

export function RoomOgImage({
  title = "",
}: RoomOgImageProps): React.JSX.Element {
  const { work, sub } = splitTitle(title.trim());
  const hasTitle = work.length > 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        backgroundColor: COLORS.bgFrom,
        backgroundImage: `radial-gradient(1100px 540px at 88% -10%, rgba(${COLORS.primaryRgb},0.28), rgba(${COLORS.primaryRgb},0) 60%), linear-gradient(135deg, ${COLORS.bgFrom} 0%, ${COLORS.bgTo} 100%)`,
        color: COLORS.text,
        fontFamily: "Noto Sans JP",
        position: "relative",
      }}
    >
      {/* Header: brand wordmark + watch-party badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: "#000000",
              border: `1px solid rgba(${COLORS.primaryRgb}, 0.30)`,
              marginRight: 24,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori (next/og) only supports <img>, not next/image */}
            <img src={LOGO_RED} width={44} height={44} alt="" />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: -1,
            }}
          >
            d-party
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "14px 28px",
            borderRadius: 999,
            border: `2px solid rgba(${COLORS.primaryRgb}, 0.35)`,
            backgroundColor: `rgba(${COLORS.primaryRgb}, 0.12)`,
            color: COLORS.primary,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          WATCH PARTY
        </div>
      </div>

      {/* Center: headline + title */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{
            display: "flex",
            color: COLORS.primary,
            fontSize: 32,
            fontWeight: 700,
            marginBottom: 20,
          }}
        >
          {hasTitle
            ? "この作品を一緒に視聴中"
            : "dアニメストア・DMM TV で同時視聴"}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: hasTitle ? 76 : 64,
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: -1,
            // Clamp very long titles to keep the layout balanced.
            overflow: "hidden",
            maxHeight: 76 * 1.18 * 3,
          }}
        >
          {hasTitle ? work : "友だちと、同じ瞬間を。"}
        </div>

        {hasTitle && sub.length > 0 ? (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 38,
              fontWeight: 400,
              color: COLORS.muted,
              overflow: "hidden",
              maxHeight: 38 * 1.3 * 2,
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>

      {/* Footer: tagline + domain */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 30,
          color: COLORS.muted,
        }}
      >
        <div style={{ display: "flex" }}>
          dアニメストア・DMM TV を友だちと同時視聴
        </div>
        <div style={{ display: "flex", fontWeight: 700, color: COLORS.text }}>
          d-party.net
        </div>
      </div>
    </div>
  );
}
