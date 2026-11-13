/** Personal usage stats, kept in `chrome.storage.sync` and never sent to the server. */

import { REACTION_TYPES, type ReactionType } from "./reactions";

/** Do not rename: users' stats live under this `chrome.storage.sync` key. */
export const PERSONAL_STATS_STORAGE_KEY = "personal_stats";

export interface PersonalStats {
  roomsCreated: number;
  roomsJoined: number;
  reactionsByType: Record<ReactionType, number>;
  /** Milliseconds. */
  connectionMs: number;
  since: number | null;
}

function zeroReactions(): Record<ReactionType, number> {
  return Object.fromEntries(REACTION_TYPES.map((t) => [t, 0])) as Record<
    ReactionType,
    number
  >;
}

export function emptyStats(): PersonalStats {
  return {
    roomsCreated: 0,
    roomsJoined: 0,
    reactionsByType: zeroReactions(),
    connectionMs: 0,
    since: null,
  };
}

export function totalReactions(stats: PersonalStats): number {
  return REACTION_TYPES.reduce(
    (sum, t) => sum + stats.reactionsByType[t],
    0,
  );
}

/** Missing or invalid fields become zero. */
export function normalizeStats(value: unknown): PersonalStats {
  const base = emptyStats();
  if (!value || typeof value !== "object") return base;
  const v = value as Record<string, unknown>;

  const num = (x: unknown): number =>
    typeof x === "number" && Number.isFinite(x) && x >= 0 ? x : 0;

  const reactions = zeroReactions();
  const stored = v.reactionsByType;
  if (stored && typeof stored === "object") {
    for (const t of REACTION_TYPES) {
      reactions[t] = num((stored as Record<string, unknown>)[t]);
    }
  }

  return {
    roomsCreated: num(v.roomsCreated),
    roomsJoined: num(v.roomsJoined),
    reactionsByType: reactions,
    connectionMs: num(v.connectionMs),
    since: typeof v.since === "number" && v.since > 0 ? v.since : null,
  };
}
