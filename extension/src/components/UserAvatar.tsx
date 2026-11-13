import { DEFAULT_USER_ICON } from "@/domain/settings";

import { USER_ICONS } from "./userIcons";

/**
 * A map lookup, not a function call, so lint does not see it as creating a component during render.
 * `iconKey` comes from other participants, so only own keys resolve: inherited ones such as
 * `constructor` or `__proto__` would otherwise be rendered as a component. The check stays in the
 * ternary's test so both branches remain plain map lookups.
 */
export function UserAvatar({
  iconKey,
  className,
}: {
  iconKey?: string;
  className?: string;
}): React.JSX.Element {
  const Icon =
    iconKey && Object.hasOwn(USER_ICONS, iconKey)
      ? USER_ICONS[iconKey]
      : USER_ICONS[DEFAULT_USER_ICON];
  return <Icon className={className} aria-hidden />;
}
