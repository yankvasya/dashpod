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
}

const QueueContext = createContext<QueueContextValue | null>(null);

/** Wraps the app so every screen (episode rows, Queue tab, player auto-advance) shares one queue. */
export function QueueProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [queue, setQueue] = useState<QueuedEpisode[]>([]);
  const [loading, setLoading] = useState(true);

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
    () => ({ queue, loading, isQueued, addEpisode, removeEpisode, reorder, refresh }),
    [queue, loading, isQueued, addEpisode, removeEpisode, reorder, refresh]
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
