import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import {
  getSubscriptions,
  subscribeToPodcast,
  unsubscribePodcast,
  upsertEpisodes,
} from '@/db/queries';
import { fetchPodcastFeed } from '@/services/rss';
import type { Podcast } from '@/types/podcast';

export function useSubscriptions() {
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

  return { subscriptions, loading, subscribe, unsubscribe, refreshAll, refresh };
}
