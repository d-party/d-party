import { lobbyResolve } from "@/infrastructure/api/generated/d-party";

/**
 * The room's title for the lobby's metadata and OG image. Never throws; an
 * unknown room or a failing backend gives an empty title.
 */
export async function resolveRoomTitle(roomId: string): Promise<string> {
  try {
    const res = await lobbyResolve(roomId, {
      next: { revalidate: 600 },
      // generateMetadata awaits this, so a hanging backend would block the page.
      signal: AbortSignal.timeout(1500),
    });
    return res.status === 200 ? res.data.title.trim() : "";
  } catch {
    return "";
  }
}
