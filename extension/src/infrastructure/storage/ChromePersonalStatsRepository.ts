import {
  emptyStats,
  normalizeStats,
  type PersonalStats,
} from "@/domain/personalStats";
import type { ReactionType } from "@/domain/reactions";

const STORAGE_KEY = "personal_stats";

/** Read-modify-write, serialized through a promise chain so quick increments do not clobber each other. */
export class ChromePersonalStatsRepository {
  private queue: Promise<void> = Promise.resolve();

  async getAll(): Promise<PersonalStats> {
    const stored = await chrome.storage.sync.get([STORAGE_KEY]);
    return normalizeStats(stored[STORAGE_KEY]);
  }

  /**
   * The queue itself never rejects: a failed write (sync quota, invalidated
   * extension context) must not skip the tasks queued after it.
   */
  private enqueue(task: () => Promise<void>): Promise<void> {
    this.queue = this.queue.then(task).catch(() => undefined);
    return this.queue;
  }

  private mutate(fn: (stats: PersonalStats) => void): Promise<void> {
    return this.enqueue(async () => {
      const stats = await this.getAll();
      if (stats.since === null) stats.since = Date.now();
      fn(stats);
      await chrome.storage.sync.set({ [STORAGE_KEY]: stats });
    });
  }

  incrementRoomsCreated(): Promise<void> {
    return this.mutate((s) => (s.roomsCreated += 1));
  }

  incrementRoomsJoined(): Promise<void> {
    return this.mutate((s) => (s.roomsJoined += 1));
  }

  incrementReaction(type: ReactionType): Promise<void> {
    return this.mutate((s) => (s.reactionsByType[type] += 1));
  }

  addConnectionMs(ms: number): Promise<void> {
    if (!(ms > 0)) return Promise.resolve();
    return this.mutate((s) => (s.connectionMs += Math.round(ms)));
  }

  reset(): Promise<void> {
    return this.enqueue(() =>
      chrome.storage.sync.set({ [STORAGE_KEY]: emptyStats() }),
    );
  }

  onChange(listener: (stats: PersonalStats) => void): () => void {
    const handler = () => {
      void this.getAll().then(listener);
    };
    chrome.storage.sync.onChanged.addListener(handler);
    return () => chrome.storage.sync.onChanged.removeListener(handler);
  }
}
