import type React from "react";

import logoUrl from "./logo-data";

type LogoProps = React.ImgHTMLAttributes<HTMLImageElement>;

/** d-party brand logo, rendered as an inline SVG data URL (shared verbatim with
 * the Chrome extension). The data URL needs no network fetch or optimization, so
 * next/image does not apply here. */
export function Logo({ alt = "d-party", ...props }: LogoProps): React.JSX.Element {
  // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, not a remote asset
  return <img src={logoUrl} alt={alt} {...props} />;
}
