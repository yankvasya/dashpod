import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';

export default function MiniPlayer() {
  const router = useRouter();
  const theme = useTheme();
  const { nowPlaying, status, episodeLoading, play, pause, isPlayerScreenOpen } = usePlayer();

  if (!nowPlaying) return null;

  const artworkUrl = nowPlaying.episode.artworkUrl ?? nowPlaying.podcastArtworkUrl;
  const isLoading = episodeLoading || status.isBuffering;
  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <Pressable
      // Belt-and-suspenders against the player screen stacking multiple times: MiniPlayerHost
      // already unmounts this whole component while the player screen is open, but guard the
      // push itself too in case that ever lags a tap (e.g. mid-transition).
      onPress={() => !isPlayerScreenOpen && router.push('/player')}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <Image source={{ uri: artworkUrl }} style={styles.artwork} />
      <ThemedView style={styles.textContainer}>
        <ThemedText numberOfLines={1}>{nowPlaying.episode.title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {nowPlaying.podcastTitle}
        </ThemedText>
      </ThemedView>
      <EpisodePlayButton
        playing={status.playing}
        loading={isLoading}
        progress={progress}
        onPress={() => (status.playing ? pause() : play())}
        size={32}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.8,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: Spacing.two,
  },
  textContainer: {
    flex: 1,
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
});
