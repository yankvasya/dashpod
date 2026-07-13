import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { addToQueue, getQueue, removeFromQueue, reorderQueue } from '@/db/queries';
import type { QueuedEpisode } from '@/types/podcast';

interface QueueContextValue {
  queue: QueuedEpisode[];
  loading: boolean;
  isQueued: (episodeId: number) => boolean;
  addEpisode: (episodeId: number) => Promise<void>;
  removeEpisode: (episodeId: number) => Promise<void>;
  reorder: (episodeIdsInOrder: number[]) => Promise<void>;
  refresh: () => Promise<void>;
  /** Episodes auto-advanced past this session (not persisted — History is the durable record). */
  playedFromQueue: QueuedEpisode[];
  /** Removes an episode from the queue because playback moved past it, recording it in
   * playedFromQueue — distinct from removeEpisode, which is for user-initiated deletion. */
  markPlayed: (episodeId: number) => Promise<void>;
  clearPlayedFromQueue: () => void;
}

const QueueContext = createContext<QueueContextValue | null>(null);

/** Wraps the app so every screen (episode rows, Queue tab, player auto-advance) shares one queue. */
export function QueueProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [queue, setQueue] = useState<QueuedEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [playedFromQueue, setPlayedFromQueue] = useState<QueuedEpisode[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await getQueue(db));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isQueued = useCallback(
    (episodeId: number) => queue.some((item) => item.episodeId === episodeId),
    [queue]
  );

  const addEpisode = useCallback(
    async (episodeId: number) => {
      await addToQueue(db, episodeId);
      await refresh();
    },
    [db, refresh]
  );

  const removeEpisode = useCallback(
    async (episodeId: number) => {
      await removeFromQueue(db, episodeId);
      await refresh();
    },
    [db, refresh]
  );

  const markPlayed = useCallback(
    async (episodeId: number) => {
      const item = queue.find((queued) => queued.episodeId === episodeId);
      await removeFromQueue(db, episodeId);
      await refresh();
      if (item) {
        // Cap it — this is a convenience list for the current session, not a log to keep forever.
        setPlayedFromQueue((prev) => [item, ...prev].slice(0, 50));
      }
    },
    [db, queue, refresh]
  );

  const clearPlayedFromQueue = useCallback(() => setPlayedFromQueue([]), []);

  // Reorders the local list immediately so dragging feels instant, then persists in the
  // background — unlike add/remove, a drag gesture can't tolerate waiting on a DB round-trip.
  const reorder = useCallback(
    async (episodeIdsInOrder: number[]) => {
      setQueue((prev) => {
        const byEpisodeId = new Map(prev.map((item) => [item.episodeId, item]));
        return episodeIdsInOrder
          .map((episodeId) => byEpisodeId.get(episodeId))
          .filter((item): item is QueuedEpisode => item != null);
      });
      await reorderQueue(db, episodeIdsInOrder);
    },
    [db]
  );

  const value = useMemo(
    () => ({
      queue,
      loading,
      isQueued,
      addEpisode,
      removeEpisode,
      reorder,
      refresh,
      playedFromQueue,
      markPlayed,
      clearPlayedFromQueue,
    }),
    [
      queue,
      loading,
      isQueued,
      addEpisode,
      removeEpisode,
      reorder,
      refresh,
      playedFromQueue,
      markPlayed,
      clearPlayedFromQueue,
    ]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueContextValue {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
}
