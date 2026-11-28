import {
  dmmLobbyResolve,
  lobbyResolve,
} from "@/infrastructure/api/generated/d-party";
import type { LobbyService } from "@/lib/links";

/** Same shape Django's `<uuid:room_id>` converter accepts. */
const ROOM_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type LobbyResolveResponse = Awaited<ReturnType<typeof lobbyResolve>>;
type LobbyResolveOptions = Parameters<typeof lobbyResolve>[1];

/** `room_id` → 視聴ページの URL とタイトル。どのサービスも応答の形は同じ。 */
const RESOLVERS: Record<
  LobbyService,
  (
    roomId: string,
    options?: LobbyResolveOptions,
  ) => Promise<LobbyResolveResponse>
> = {
  "anime-store": lobbyResolve,
  "dmm-tv": dmmLobbyResolve,
};

/** The service's `GET /api/v1/<service>/lobby/{room_id}`. */
export function resolveLobby(
  service: LobbyService,
  roomId: string,
  options?: LobbyResolveOptions,
): Promise<LobbyResolveResponse> {
  return RESOLVERS[service](roomId, options);
}

/**
 * The room's title for the lobby's metadata and OG image. Never throws; an
 * unknown room or a failing backend gives an empty title.
 */
export async function resolveRoomTitle(
  roomId: string,
  service: LobbyService = "anime-store",
): Promise<string> {
  // The id is interpolated into a server-side request path as is, so `../` in
  // it would reach other paths on the internal backend origin.
  if (!ROOM_ID_PATTERN.test(roomId)) return "";
  try {
    const res = await resolveLobby(service, roomId, {
      next: { revalidate: 600 },
      // generateMetadata awaits this, so a hanging backend would block the page.
      signal: AbortSignal.timeout(1500),
    });
    return res.status === 200 ? res.data.title.trim() : "";
  } catch {
    return "";
  }
}
