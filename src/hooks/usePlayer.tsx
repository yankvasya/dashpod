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
  hasPrevious: boolean;
  /** Restarts the current episode if more than 10s in; otherwise loads the last-played episode. */
  skipToPrevious: () => void;
  sleepTimer: SleepTimerState;
  setSleepTimerMinutes: (minutes: number) => void;
  setSleepTimerEndOfEpisode: () => void;
  cancelSleepTimer: () => void;
  /** True while the sleep timer's volume ramp-down is in progress (fires just before it pauses). */
  isFadingOut: boolean;
  /** True exactly while the full player screen (player.tsx) is mounted — set directly from that
   * screen's own mount/unmount lifecycle rather than derived from the router's pathname, since the
   * pathname-based check this replaced didn't reliably hide the mini player over a modal route. */
  isPlayerScreenOpen: boolean;
  setPlayerScreenOpen: (open: boolean) => void;
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
  const [hasPrevious, setHasPrevious] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isPlayerScreenOpen, setPlayerScreenOpen] = useState(false);
  const segmentRef = useRef<ListeningSegment | null>(null);
  const nowPlayingRef = useRef<NowPlaying | null>(null);
  const queueRef = useRef(queue);
  const rateRef = useRef(1);
  // Single-slot "back" — the episode that was playing immediately before the current one, so the
  // previous button can return to it. Not a full history stack: pressing it again toggles back to
  // whatever was playing before *that*, which is deliberately simple rather than deep undo.
  const previousEpisodeRef = useRef<NowPlaying | null>(null);
  nowPlayingRef.current = nowPlaying;
  queueRef.current = queue;
  // Sleep timer's setInterval outlives any single render — call through this ref rather than
  // closing over `pause` directly, since `pause` itself closes over `status.currentTime` and is
  // recreated on every status tick (a stale closure would flush/persist the wrong position).
  const pauseRef = useRef<() => void>(() => {});
  // The didJustFinish effect below calls skipToNext, whose identity depends on `queue` — reading
  // it through a ref (rather than listing skipToNext/queue as effect dependencies) keeps the
  // effect from re-triggering itself every time it calls queue.removeEpisode further down.
  const skipToNextRef = useRef<() => void>(() => {});
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Guards the didJustFinish effect below against running its body more than once per actual
  // finish event — the effect's dependencies (nowPlaying, sleepTimer.mode) can themselves change
  // as a *result* of running the body once, which would otherwise re-trigger it while
  // status.didJustFinish is still (or again) true.
  const handledFinishRef = useRef(false);

  // Ramps volume down to 0 over `fadeMs`, then pauses and restores volume to full — used when the
  // sleep timer fires, so playback doesn't cut out abruptly while someone's falling asleep.
  const fadeOutAndPause = useCallback(
    (fadeMs = 5000) => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      setIsFadingOut(true);
      const steps = 20;
      const stepMs = fadeMs / steps;
      let step = 0;
      fadeIntervalRef.current = setInterval(() => {
        step += 1;
        player.volume = Math.max(0, 1 - step / steps);
        if (step >= steps) {
          if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
          fadeIntervalRef.current = null;
          pauseRef.current();
          player.volume = 1;
          setIsFadingOut(false);
        }
      }, stepMs);
    },
    [player]
  );

  useEffect(() => {
    return () => {
      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    };
  }, []);

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
      // Whatever was playing becomes "previous" — captured before it's replaced below.
      if (nowPlayingRef.current) {
        previousEpisodeRef.current = nowPlayingRef.current;
        setHasPrevious(true);
      }
      // Flush the outgoing episode's segment in the background — don't block the UI switching
      // to the new episode on a DB write for the old one.
      flushSegment(status.currentTime);
      setEpisodeLoadingRaw(true);
      loadEpisodeIntoPlayer(episode, podcastTitle, podcastArtworkUrl);
      if (fadeIntervalRef.current) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
        setIsFadingOut(false);
      }
      player.volume = 1;
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
    queue.markPlayed(next.episodeId);
    const localUri = downloads.getDownloadedUri(next.episodeId);
    const episode = toPlayableEpisode(next);
    loadEpisode(localUri ? { ...episode, audioUrl: localUri } : episode, next.podcastTitle, next.artworkUrl).then(
      () => play()
    );
  }, [queue, nowPlaying, downloads, loadEpisode, play]);
  skipToNextRef.current = skipToNext;

  const skipToPrevious = useCallback(() => {
    if (status.currentTime >= 10) {
      seekTo(0);
      return;
    }
    const previous = previousEpisodeRef.current;
    if (!previous) {
      seekTo(0);
      return;
    }
    loadEpisode(previous.episode, previous.podcastTitle, previous.podcastArtworkUrl).then(() => play());
  }, [status.currentTime, seekTo, loadEpisode, play]);

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
          fadeOutAndPause();
          setSleepTimer({ mode: 'off', remainingSeconds: null });
        } else {
          setSleepTimer({ mode: 'duration', remainingSeconds: remaining });
        }
      }, 1000);
    },
    [clearSleepTimerInterval, fadeOutAndPause]
  );

  const setSleepTimerEndOfEpisode = useCallback(() => {
    clearSleepTimerInterval();
    setSleepTimer({ mode: 'endOfEpisode', remainingSeconds: null });
  }, [clearSleepTimerInterval]);

  useEffect(() => clearSleepTimerInterval, [clearSleepTimerInterval]);

  useEffect(() => {
    if (!status.didJustFinish) {
      // Reset once the native "finished" flag clears, so the next real finish can be handled.
      handledFinishRef.current = false;
      return;
    }
    if (handledFinishRef.current || !nowPlaying) return;
    handledFinishRef.current = true;

    flushSegment(status.duration).then(() => persistPosition(0, true));
    // Clean up: if the episode that just finished was itself queued (e.g. the user queued the
    // episode they were already playing), drop it now rather than leaving it to resurface and
    // replay once it reaches the front of the queue later. Read through a ref rather than
    // depending on `queue` directly, since markPlayed changes the queue context's identity.
    if (nowPlaying.episode.id != null) {
      queueRef.current.markPlayed(nowPlaying.episode.id);
    }
    // A sleep timer set to "End of Episode" means stop here rather than auto-advancing.
    if (sleepTimer.mode === 'endOfEpisode') {
      fadeOutAndPause();
      cancelSleepTimer();
      return;
    }
    skipToNextRef.current();
  }, [
    status.didJustFinish,
    status.duration,
    nowPlaying,
    flushSegment,
    persistPosition,
    sleepTimer.mode,
    cancelSleepTimer,
    fadeOutAndPause,
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
      hasPrevious,
      skipToPrevious,
      sleepTimer,
      setSleepTimerMinutes,
      setSleepTimerEndOfEpisode,
      cancelSleepTimer,
      isFadingOut,
      isPlayerScreenOpen,
      setPlayerScreenOpen,
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
      hasPrevious,
      skipToPrevious,
      sleepTimer,
      setSleepTimerMinutes,
      setSleepTimerEndOfEpisode,
      isFadingOut,
      cancelSleepTimer,
      isPlayerScreenOpen,
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
