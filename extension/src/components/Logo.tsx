import type React from "react";

import logoUrl from "./logo-data";

type LogoProps = React.ImgHTMLAttributes<HTMLImageElement>;

/** A data URL, so it works in Storybook (no chrome.runtime) and in the Shadow DOM. */

export function Logo({ alt = "d-party", ...props }: LogoProps): React.JSX.Element {
  return <img src={logoUrl} alt={alt} {...props} />;
}
