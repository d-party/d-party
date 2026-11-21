import { lobbyResolve } from "@/infrastructure/api/generated/d-party";

/** Same shape Django's `<uuid:room_id>` converter accepts. */
const ROOM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The room's title for the lobby's metadata and OG image. Never throws; an
 * unknown room or a failing backend gives an empty title.
 */
export async function resolveRoomTitle(roomId: string): Promise<string> {
  // The id is interpolated into a server-side request path as is, so `../` in
  // it would reach other paths on the internal backend origin.
  if (!ROOM_ID_PATTERN.test(roomId)) return "";
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
