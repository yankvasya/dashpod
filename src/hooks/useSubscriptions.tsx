import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import {
  getSubscriptions,
  subscribeToPodcast,
  unsubscribePodcast,
  upsertEpisodes,
} from '@/db/queries';
import { fetchPodcastFeed } from '@/services/rss';
import type { Podcast } from '@/types/podcast';

interface SubscriptionsContextValue {
  subscriptions: Podcast[];
  loading: boolean;
  subscribe: (feedUrl: string) => Promise<number>;
  unsubscribe: (podcastId: number) => Promise<void>;
  refreshAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const SubscriptionsContext = createContext<SubscriptionsContextValue | null>(null);

/** Wraps the app so every screen shares one subscriptions list instead of each fetching its own. */
export function SubscriptionsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [subscriptions, setSubscriptions] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSubscriptions(await getSubscriptions(db));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subscribe = useCallback(
    async (feedUrl: string) => {
      const { podcast, episodes } = await fetchPodcastFeed(feedUrl);
      const lastFetchedAt = Math.floor(Date.now() / 1000);
      const podcastId = await subscribeToPodcast(db, { ...podcast, lastFetchedAt });
      await upsertEpisodes(db, podcastId, episodes);
      await refresh();
      return podcastId;
    },
    [db, refresh]
  );

  const unsubscribe = useCallback(
    async (podcastId: number) => {
      await unsubscribePodcast(db, podcastId);
      await refresh();
    },
    [db, refresh]
  );

  const refreshFeed = useCallback(
    async (podcast: Podcast) => {
      const { episodes } = await fetchPodcastFeed(podcast.feedUrl);
      await upsertEpisodes(db, podcast.id, episodes);
    },
    [db]
  );

  const refreshAll = useCallback(async () => {
    const current = await getSubscriptions(db);
    await Promise.all(current.map((podcast) => refreshFeed(podcast)));
    await refresh();
  }, [db, refreshFeed, refresh]);

  const value = useMemo(
    () => ({ subscriptions, loading, subscribe, unsubscribe, refreshAll, refresh }),
    [subscriptions, loading, subscribe, unsubscribe, refreshAll, refresh]
  );

  return <SubscriptionsContext.Provider value={value}>{children}</SubscriptionsContext.Provider>;
}

export function useSubscriptions(): SubscriptionsContextValue {
  const context = useContext(SubscriptionsContext);
  if (!context) {
    throw new Error('useSubscriptions must be used within a SubscriptionsProvider');
  }
  return context;
}
