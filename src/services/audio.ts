import { createAudioPlayer, setAudioModeAsync, type AudioMetadata, type AudioPlayer } from 'expo-audio';

import type { Episode } from '@/types/podcast';

let player: AudioPlayer | null = null;

/** Returns the app's single persistent audio player, creating it on first use. */
export function getPlayer(): AudioPlayer {
  if (!player) {
    player = createAudioPlayer(null, { updateInterval: 250 });
  }
  return player;
}

/** Configures the audio session for background podcast playback. Call once at app startup. */
export async function configureAudioSession(): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  });
}

export function loadEpisode(
  episode: Pick<Episode, 'audioUrl' | 'title' | 'artworkUrl'>,
  podcastTitle: string,
  podcastArtworkUrl: string
): void {
  const activePlayer = getPlayer();
  activePlayer.replace(episode.audioUrl);
  const metadata: AudioMetadata = {
    title: episode.title,
    artist: podcastTitle,
    artworkUrl: episode.artworkUrl ?? podcastArtworkUrl,
  };
  activePlayer.setActiveForLockScreen(true, metadata, {
    showSeekForward: true,
    showSeekBackward: true,
  });
}
