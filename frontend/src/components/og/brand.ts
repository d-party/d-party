import logoUrl from "@/components/logo-data";

/**
 * Brand palette converted from the globals.css theme tokens (oklch) to hex so
 * Satori renders them reliably. `primary` is the d-party theme red
 * (`--primary: oklch(0.637 0.237 25.331)`), background/foreground/muted mirror
 * the dark theme — intentionally neutral (no magenta tint) with a red accent.
 */
export const COLORS = {
  bgFrom: "#0d0e13", // --background
  bgTo: "#16171d", // slightly lifted neutral for subtle depth
  primary: "#fb2c36", // --primary (theme red)
  primaryRgb: "251, 44, 54", // primary as rgb for translucent glows/fills
  text: "#fafafa", // --foreground
  muted: "#a1a1a1", // --muted-foreground
} as const;

/**
 * The brand mark recolored to the theme red. The app icon is a red logo on a
 * black tile, so the cards keep that treatment. The source SVG (logo-data.ts)
 * bakes its fill as `#cc0033`; swap it for the brighter theme red.
 */
export const LOGO_RED = logoUrl.replace("%23cc0033", "%23fb2c36");
