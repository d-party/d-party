/**
 * Shared layout for every Open Graph card of the site (1200×630): brand header,
 * eyebrow + headline + sub, footer. `SiteOgImage` and `RoomOgImage` only fill in
 * the slots, so a link to the site and a link to a room look alike.
 *
 * Written with inline styles only, using the flexbox subset that Satori
 * (the engine behind `next/og`'s `ImageResponse`, i.e. `@vercel/og`) supports.
 * This lets the very same component be:
 *   - rendered to a PNG on the server by the `opengraph-image.tsx` /
 *     `twitter-image.tsx` route files
 *   - previewed as plain HTML in Storybook (`*.stories.tsx`).
 *
 * Keep it free of Tailwind classes, external CSS and unsupported CSS features.
 */

import { COLORS, LOGO_RED } from "@/components/og/brand";

export interface OgCardProps {
  /** Small red line above the headline, e.g. `"この作品を一緒に視聴中"`. */
  eyebrow: string;
  /** Main line, set in the largest type. */
  headline: string;
  /** Optional muted line under the headline (episode, tagline, …). */
  sub?: string;
  /** Pill in the top-right corner. */
  badge?: string;
  /** Headline size in px. Long, wrapping headlines want a smaller size. */
  headlineSize?: number;
}

export function OgCard({
  eyebrow,
  headline,
  sub,
  badge = "WATCH PARTY",
  headlineSize = 76,
}: OgCardProps): React.JSX.Element {
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
      {/* Header: brand wordmark + badge */}
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
          {badge}
        </div>
      </div>

      {/* Center: eyebrow + headline + sub */}
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
          {eyebrow}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: headlineSize,
            fontWeight: 700,
            lineHeight: 1.18,
            letterSpacing: -1,
            // Clamp very long headlines to keep the layout balanced.
            overflow: "hidden",
            maxHeight: headlineSize * 1.18 * 3,
          }}
        >
          {headline}
        </div>

        {sub ? (
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
        <div style={{ display: "flex" }}>dアニメストアを友だちと同時視聴</div>
        <div style={{ display: "flex", fontWeight: 700, color: COLORS.text }}>
          d-party.net
        </div>
      </div>
    </div>
  );
}
