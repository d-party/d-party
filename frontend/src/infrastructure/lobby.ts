import { lobbyResolve } from "@/infrastructure/api/generated/d-party";

export interface ResolvedRoom {
  /** Empty when unknown. */
  title: string;
  found: boolean;
}

/** For the lobby's metadata and OG image. Never throws; failures give an empty title. */
export async function resolveRoom(roomId: string): Promise<ResolvedRoom> {
  try {
    const res = await lobbyResolve(roomId, {
      next: { revalidate: 600 },
      // generateMetadata awaits this, so a hanging backend would block the page.

      signal: AbortSignal.timeout(1500),
    });
    if (res.status === 200) {
      return { title: (res.data.title ?? "").trim(), found: true };
    }
    return { title: "", found: false };
  } catch {
    return { title: "", found: false };
  }
}
