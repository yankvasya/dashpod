import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  // Guards against overlapping load()/refresh() calls landing out of order — e.g. subscribing
  // triggers its own feed fetch and flips `existing` from null to set, which recreates `load`
  // and re-fires the effect below; if the *original* preview-mode fetch (from before subscribing)
  // resolves afterward, it would otherwise overwrite the correct DB-loaded episodes with a stale
  // result. Only the most recently started request is allowed to commit its results.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      if (existing) {
        setPodcast(existing);
        const [loadedEpisodes, loadedPlaybackStates] = await Promise.all([
          getEpisodesForPodcast(db, existing.id),
          getPlaybackStatesForPodcast(db, existing.id),
        ]);
        if (requestIdRef.current !== requestId) return;
        setEpisodes(loadedEpisodes);
        setPlaybackStates(loadedPlaybackStates);
      } else {
        const feed = await fetchPodcastFeed(feedUrl);
        if (requestIdRef.current !== requestId) return;
        setPodcast(feed.podcast);
        setEpisodes(feed.episodes);
        setPlaybackStates(new Map());
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [db, existing, feedUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setRefreshing(true);
    try {
      if (existing) {
        const feed = await fetchPodcastFeed(feedUrl);
        await upsertEpisodes(db, existing.id, feed.episodes);
        const [loadedEpisodes, loadedPlaybackStates] = await Promise.all([
          getEpisodesForPodcast(db, existing.id),
          getPlaybackStatesForPodcast(db, existing.id),
        ]);
        if (requestIdRef.current !== requestId) return;
        setEpisodes(loadedEpisodes);
        setPlaybackStates(loadedPlaybackStates);
      } else {
        await load();
      }
    } finally {
      if (requestIdRef.current === requestId) setRefreshing(false);
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
