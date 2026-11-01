import { DEFAULT_USER_ICON, USER_ICONS } from "./userIcons";

/** A map lookup, not a function call, so lint does not see it as creating a component during render. */

export function UserAvatar({
  iconKey,
  className,
}: {
  iconKey?: string;
  className?: string;
}): React.JSX.Element {
  const Icon =
    (iconKey && USER_ICONS[iconKey]) || USER_ICONS[DEFAULT_USER_ICON];
  return <Icon className={className} aria-hidden />;
}
