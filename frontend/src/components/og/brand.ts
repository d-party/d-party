import logoUrl from "@/components/logo-data";

/** globals.css tokens converted from oklch to hex for Satori. */
export const COLORS = {
  bgFrom: "#0d0e13", // --background
  bgTo: "#16171d", // slightly lifted neutral for subtle depth
  primary: "#fb2c36", // --primary (theme red)
  primaryRgb: "251, 44, 54", // primary as rgb for translucent glows/fills
  text: "#fafafa", // --foreground
  muted: "#a1a1a1", // --muted-foreground
} as const;

/** The logo with its baked `#cc0033` fill swapped for the theme red. */

export const LOGO_RED = logoUrl.replace("%23cc0033", "%23fb2c36");
