import { createContext, useContext } from "react";

/** Radix portal target inside a Shadow DOM, so portals keep its styles. Null means document.body. */
export const PortalContainerContext = createContext<HTMLElement | null>(null);

export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext);
}
