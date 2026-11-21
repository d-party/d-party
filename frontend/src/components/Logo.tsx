import logoUrl from "./logo-data";

type LogoProps = React.ImgHTMLAttributes<HTMLImageElement>;

export function Logo({ alt = "d-party", ...props }: LogoProps): React.JSX.Element {
  // eslint-disable-next-line @next/next/no-img-element -- inline SVG data URL, not a remote asset
  return <img src={logoUrl} alt={alt} {...props} />;
}
