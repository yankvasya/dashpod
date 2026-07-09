import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getEpisodesForPodcast, getPlaybackStatesForPodcast, upsertEpisodes } from '@/db/queries';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { fetchPodcastFeed } from '@/services/rss';
import type { Episode, PlaybackState, Podcast } from '@/types/podcast';

type PreviewPodcast = Omit<Podcast, 'id' | 'lastFetchedAt'>;
type PreviewEpisode = Omit<Episode, 'id' | 'podcastId'>;

export function usePodcastDetail(feedUrl: string) {
  const db = useSQLiteContext();
  const { subscriptions, subscribe, unsubscribe } = useSubscriptions();
  const existing = subscriptions.find((podcast) => podcast.feedUrl === feedUrl) ?? null;

  const [podcast, setPodcast] = useState<Podcast | PreviewPodcast | null>(null);
  const [episodes, setEpisodes] = useState<(Episode | PreviewEpisode)[]>([]);
  const [playbackStates, setPlaybackStates] = useState<Map<number, PlaybackState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (existing) {
        setPodcast(existing);
        const [loadedEpisodes, loadedPlaybackStates] = await Promise.all([
          getEpisodesForPodcast(db, existing.id),
          getPlaybackStatesForPodcast(db, existing.id),
        ]);
        setEpisodes(loadedEpisodes);
        setPlaybackStates(loadedPlaybackStates);
      } else {
        const feed = await fetchPodcastFeed(feedUrl);
        setPodcast(feed.podcast);
        setEpisodes(feed.episodes);
        setPlaybackStates(new Map());
      }
    } finally {
      setLoading(false);
    }
  }, [db, existing, feedUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (existing) {
        const feed = await fetchPodcastFeed(feedUrl);
        await upsertEpisodes(db, existing.id, feed.episodes);
        const [loadedEpisodes, loadedPlaybackStates] = await Promise.all([
          getEpisodesForPodcast(db, existing.id),
          getPlaybackStatesForPodcast(db, existing.id),
        ]);
        setEpisodes(loadedEpisodes);
        setPlaybackStates(loadedPlaybackStates);
      } else {
        await load();
      }
    } finally {
      setRefreshing(false);
    }
  }, [db, existing, feedUrl, load]);

  const toggleSubscription = useCallback(async () => {
    setSubscribing(true);
    try {
      if (existing) {
        await unsubscribe(existing.id);
      } else {
        await subscribe(feedUrl);
      }
    } finally {
      setSubscribing(false);
    }
  }, [existing, feedUrl, subscribe, unsubscribe]);

  return {
    podcast,
    episodes,
    playbackStates,
    isSubscribed: Boolean(existing),
    loading,
    refreshing,
    subscribing,
    refresh,
    toggleSubscription,
  };
}
