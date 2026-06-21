import { lobbyResolve } from "@/infrastructure/api/generated/d-party";

export interface ResolvedRoom {
  /** Anime title saved at room creation. Empty when unknown or room not found. */
  title: string;
  /** Whether the room exists (and is still alive) on the backend. */
  found: boolean;
}

/**
 * Server-side room lookup used by the lobby route's metadata and OG image.
 *
 * Reuses the generated `lobbyResolve` REST client. Never throws: an unknown or
 * missing room (and any network error) resolves to an empty title so OGP/meta
 * fall back to generic copy. `title` may be empty for rooms created by older
 * extension versions that did not send a title.
 */
export async function resolveRoom(roomId: string): Promise<ResolvedRoom> {
  try {
    const res = await lobbyResolve(roomId, { next: { revalidate: 600 } });
    if (res.status === 200) {
      return { title: (res.data.title ?? "").trim(), found: true };
    }
    return { title: "", found: false };
  } catch {
    return { title: "", found: false };
  }
}
