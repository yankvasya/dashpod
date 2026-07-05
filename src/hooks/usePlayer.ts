import { useAudioPlayerStatus } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getPlaybackState, recordListeningEvent, setPlaybackState } from '@/db/queries';
import { getPlayer, loadEpisode as loadEpisodeIntoPlayer } from '@/services/audio';
import type { Episode } from '@/types/podcast';

interface NowPlaying {
  episode: Episode;
  podcastTitle: string;
  podcastArtworkUrl: string;
}

interface ListeningSegment {
  startedAt: number;
  positionStart: number;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

export function usePlayer() {
  const db = useSQLiteContext();
  const player = getPlayer();
  const status = useAudioPlayerStatus(player);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const segmentRef = useRef<ListeningSegment | null>(null);
  const nowPlayingRef = useRef<NowPlaying | null>(null);
  nowPlayingRef.current = nowPlaying;

  const flushSegment = useCallback(
    async (endPosition: number) => {
      const segment = segmentRef.current;
      const episode = nowPlayingRef.current?.episode;
      segmentRef.current = null;
      if (!segment || !episode) return;
      const listenedSeconds = endPosition - segment.positionStart;
      if (listenedSeconds <= 0) return;
      await recordListeningEvent(db, {
        episodeId: episode.id,
        startedAt: segment.startedAt,
        endedAt: nowSeconds(),
        positionStart: segment.positionStart,
        positionEnd: endPosition,
        listenedSeconds,
      });
    },
    [db]
  );

  const persistPosition = useCallback(
    async (position: number) => {
      const episode = nowPlayingRef.current?.episode;
      if (!episode) return;
      await setPlaybackState(db, { episodeId: episode.id, position, updatedAt: nowSeconds() });
    },
    [db]
  );

  const loadEpisode = useCallback(
    async (episode: Episode, podcastTitle: string, podcastArtworkUrl: string) => {
      await flushSegment(status.currentTime);
      loadEpisodeIntoPlayer(episode, podcastTitle, podcastArtworkUrl);
      setNowPlaying({ episode, podcastTitle, podcastArtworkUrl });
      const savedState = await getPlaybackState(db, episode.id);
      if (savedState && savedState.position > 0) {
        await player.seekTo(savedState.position);
      }
    },
    [db, flushSegment, player, status.currentTime]
  );

  const play = useCallback(() => {
    if (!segmentRef.current) {
      segmentRef.current = { startedAt: nowSeconds(), positionStart: status.currentTime };
    }
    player.play();
  }, [player, status.currentTime]);

  const pause = useCallback(async () => {
    player.pause();
    await flushSegment(status.currentTime);
    await persistPosition(status.currentTime);
  }, [flushSegment, persistPosition, player, status.currentTime]);

  const seekTo = useCallback(
    async (seconds: number) => {
      const wasPlaying = status.playing;
      await flushSegment(status.currentTime);
      await player.seekTo(seconds);
      if (wasPlaying) {
        segmentRef.current = { startedAt: nowSeconds(), positionStart: seconds };
      }
      await persistPosition(seconds);
    },
    [flushSegment, persistPosition, player, status.currentTime, status.playing]
  );

  const setRate = useCallback(
    (rate: number) => {
      player.setPlaybackRate(rate);
    },
    [player]
  );

  useEffect(() => {
    if (!status.didJustFinish || !nowPlaying) return;
    flushSegment(status.duration).then(() => persistPosition(0));
  }, [status.didJustFinish, status.duration, nowPlaying, flushSegment, persistPosition]);

  return {
    nowPlaying,
    status,
    loadEpisode,
    play,
    pause,
    seekTo,
    setRate,
  };
}
