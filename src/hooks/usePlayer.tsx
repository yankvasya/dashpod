import { useAudioPlayerStatus, type AudioStatus } from 'expo-audio';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { getPlaybackState, recordListeningEvent, setPlaybackState } from '@/db/queries';
import { useDownloads } from '@/hooks/useDownloads';
import { useQueue } from '@/hooks/useQueue';
import { getPlayer, loadEpisode as loadEpisodeIntoPlayer } from '@/services/audio';
import type { Episode, QueuedEpisode } from '@/types/podcast';

/** An episode that hasn't been subscribed to yet has no DB id — playback still works, just without persisted stats/resume. */
type PlayableEpisode = Omit<Episode, 'id' | 'podcastId'> & { id?: number };

interface NowPlaying {
  episode: PlayableEpisode;
  podcastTitle: string;
  podcastArtworkUrl: string;
}

interface ListeningSegment {
  startedAt: number;
  positionStart: number;
}

type SleepTimerMode = 'off' | 'duration' | 'endOfEpisode';

interface SleepTimerState {
  mode: SleepTimerMode;
  /** Live-updating countdown, only meaningful when mode is 'duration'. */
  remainingSeconds: number | null;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

function toPlayableEpisode(item: QueuedEpisode): PlayableEpisode {
  return {
    id: item.episodeId,
    guid: item.guid,
    title: item.episodeTitle,
    description: item.description,
    audioUrl: item.audioUrl,
    durationSeconds: item.durationSeconds,
    publishedAt: item.publishedAt,
    artworkUrl: item.artworkUrl,
  };
}

interface PlayerContextValue {
  nowPlaying: NowPlaying | null;
  status: AudioStatus;
  /** True from the instant a new episode is requested until it's actually ready to play — tracked
   * explicitly rather than derived from `status`, since native status events lag a beat behind
   * our own state updates. */
  episodeLoading: boolean;
  loadEpisode: (episode: PlayableEpisode, podcastTitle: string, podcastArtworkUrl: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => Promise<void>;
  playbackRate: number;
  setRate: (rate: number) => void;
  hasNext: boolean;
  skipToNext: () => void;
  sleepTimer: SleepTimerState;
  setSleepTimerMinutes: (minutes: number) => void;
  setSleepTimerEndOfEpisode: () => void;
  cancelSleepTimer: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/** Wraps the app so every screen (mini player, full player, episode rows) shares one playback state. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const queue = useQueue();
  const downloads = useDownloads();
  const player = getPlayer();
  const status = useAudioPlayerStatus(player);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [episodeLoadingRaw, setEpisodeLoadingRaw] = useState(false);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const segmentRef = useRef<ListeningSegment | null>(null);
  const nowPlayingRef = useRef<NowPlaying | null>(null);
  const rateRef = useRef(1);
  nowPlayingRef.current = nowPlaying;
  // Sleep timer's setInterval outlives any single render — call through this ref rather than
  // closing over `pause` directly, since `pause` itself closes over `status.currentTime` and is
  // recreated on every status tick (a stale closure would flush/persist the wrong position).
  const pauseRef = useRef<() => void>(() => {});

  const flushSegment = useCallback(
    async (endPosition: number) => {
      const segment = segmentRef.current;
      const episode = nowPlayingRef.current?.episode;
      segmentRef.current = null;
      if (!segment || !episode || episode.id == null) return;
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
    async (position: number, isFinished = false) => {
      const episode = nowPlayingRef.current?.episode;
      if (!episode || episode.id == null) return;
      await setPlaybackState(db, {
        episodeId: episode.id,
        position,
        isFinished,
        updatedAt: nowSeconds(),
      });
    },
    [db]
  );

  const loadEpisode = useCallback(
    async (episode: PlayableEpisode, podcastTitle: string, podcastArtworkUrl: string) => {
      // Flush the outgoing episode's segment in the background — don't block the UI switching
      // to the new episode on a DB write for the old one.
      flushSegment(status.currentTime);
      setEpisodeLoadingRaw(true);
      loadEpisodeIntoPlayer(episode, podcastTitle, podcastArtworkUrl);
      if (rateRef.current !== 1) {
        // Defensive: replace() may or may not reset the native rate to default, undocumented
        // either way — cheap to just re-apply the selected rate on every load.
        player.setPlaybackRate(rateRef.current);
      }
      setNowPlaying({ episode, podcastTitle, podcastArtworkUrl });
      if (episode.id != null) {
        // Resume-position lookup runs in the background rather than being awaited here — the
        // caller's play() (for the play-pause-button path) fires right after this resolves, and
        // waiting on a DB round-trip first left a window where the UI could flash an intermediate
        // play/pause state before playback actually started.
        getPlaybackState(db, episode.id).then((savedState) => {
          if (savedState && savedState.position > 0) {
            player.seekTo(savedState.position);
          }
        });
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

  const pause = useCallback(() => {
    player.pause();
    const position = status.currentTime;
    flushSegment(position);
    persistPosition(position);
  }, [flushSegment, persistPosition, player, status.currentTime]);
  pauseRef.current = pause;

  const seekTo = useCallback(
    async (seconds: number) => {
      const wasPlaying = status.playing;
      // Flush before the native seek call (synchronous part clears segmentRef immediately;
      // the DB write itself runs in the background without delaying the seek).
      flushSegment(status.currentTime);
      await player.seekTo(seconds);
      if (wasPlaying) {
        segmentRef.current = { startedAt: nowSeconds(), positionStart: seconds };
      }
      persistPosition(seconds);
    },
    [flushSegment, persistPosition, player, status.currentTime, status.playing]
  );

  const setRate = useCallback(
    (rate: number) => {
      rateRef.current = rate;
      setPlaybackRateState(rate);
      player.setPlaybackRate(rate);
    },
    [player]
  );

  const skipToNext = useCallback(() => {
    // Exclude the currently-playing episode itself — if the user queued the episode they're
    // already listening to, it shouldn't be treated as "next" until something else is playing.
    const next = queue.queue.find((item) => item.episodeId !== nowPlaying?.episode.id);
    if (!next) return;
    queue.removeEpisode(next.episodeId);
    const localUri = downloads.getDownloadedUri(next.episodeId);
    const episode = toPlayableEpisode(next);
    loadEpisode(localUri ? { ...episode, audioUrl: localUri } : episode, next.podcastTitle, next.artworkUrl).then(
      () => play()
    );
  }, [queue, nowPlaying, downloads, loadEpisode, play]);

  const [sleepTimer, setSleepTimer] = useState<SleepTimerState>({ mode: 'off', remainingSeconds: null });
  const sleepTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSleepTimerInterval = useCallback(() => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }
  }, []);

  const cancelSleepTimer = useCallback(() => {
    clearSleepTimerInterval();
    setSleepTimer({ mode: 'off', remainingSeconds: null });
  }, [clearSleepTimerInterval]);

  const setSleepTimerMinutes = useCallback(
    (minutes: number) => {
      clearSleepTimerInterval();
      const endsAt = Date.now() + minutes * 60_000;
      setSleepTimer({ mode: 'duration', remainingSeconds: minutes * 60 });
      sleepTimerIntervalRef.current = setInterval(() => {
        const remaining = Math.round((endsAt - Date.now()) / 1000);
        if (remaining <= 0) {
          clearSleepTimerInterval();
          pauseRef.current();
          setSleepTimer({ mode: 'off', remainingSeconds: null });
        } else {
          setSleepTimer({ mode: 'duration', remainingSeconds: remaining });
        }
      }, 1000);
    },
    [clearSleepTimerInterval]
  );

  const setSleepTimerEndOfEpisode = useCallback(() => {
    clearSleepTimerInterval();
    setSleepTimer({ mode: 'endOfEpisode', remainingSeconds: null });
  }, [clearSleepTimerInterval]);

  useEffect(() => clearSleepTimerInterval, [clearSleepTimerInterval]);

  useEffect(() => {
    if (!status.didJustFinish || !nowPlaying) return;
    flushSegment(status.duration).then(() => persistPosition(0, true));
    // Clean up: if the episode that just finished was itself queued (e.g. the user queued the
    // episode they were already playing), drop it now rather than leaving it to resurface and
    // replay once it reaches the front of the queue later.
    if (nowPlaying.episode.id != null) {
      queue.removeEpisode(nowPlaying.episode.id);
    }
    // A sleep timer set to "End of Episode" means stop here rather than auto-advancing.
    if (sleepTimer.mode === 'endOfEpisode') {
      cancelSleepTimer();
      return;
    }
    skipToNext();
  }, [
    status.didJustFinish,
    status.duration,
    nowPlaying,
    flushSegment,
    persistPosition,
    queue,
    skipToNext,
    sleepTimer.mode,
    cancelSleepTimer,
  ]);

  useEffect(() => {
    if (episodeLoadingRaw && status.isLoaded && !status.isBuffering) {
      setEpisodeLoadingRaw(false);
    }
  }, [episodeLoadingRaw, status.isLoaded, status.isBuffering]);

  // Debounce the *displayed* loading state: local/already-buffered sources often resolve within
  // a few ms, and flashing a spinner for that is worse than just not showing one. Only show it if
  // loading is still ongoing after a short delay; hide it immediately once it's done.
  useEffect(() => {
    if (!episodeLoadingRaw) {
      setEpisodeLoading(false);
      return;
    }
    const timeout = setTimeout(() => setEpisodeLoading(true), 150);
    return () => clearTimeout(timeout);
  }, [episodeLoadingRaw]);

  const value = useMemo(
    () => ({
      nowPlaying,
      status,
      episodeLoading,
      loadEpisode,
      play,
      pause,
      seekTo,
      playbackRate,
      setRate,
      hasNext: queue.queue.length > 0,
      skipToNext,
      sleepTimer,
      setSleepTimerMinutes,
      setSleepTimerEndOfEpisode,
      cancelSleepTimer,
    }),
    [
      nowPlaying,
      status,
      episodeLoading,
      loadEpisode,
      play,
      pause,
      seekTo,
      playbackRate,
      setRate,
      queue.queue.length,
      skipToNext,
      sleepTimer,
      setSleepTimerMinutes,
      setSleepTimerEndOfEpisode,
      cancelSleepTimer,
    ]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
