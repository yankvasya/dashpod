import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { PlayPauseIcon } from '@/components/player/PlayPauseIcon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';

export default function MiniPlayer() {
  const router = useRouter();
  const theme = useTheme();
  const { nowPlaying, status, episodeLoading, play, pause } = usePlayer();

  if (!nowPlaying) return null;

  const artworkUrl = nowPlaying.episode.artworkUrl ?? nowPlaying.podcastArtworkUrl;
  const isLoading = episodeLoading || status.isBuffering;

  return (
    <Pressable
      onPress={() => router.push('/player')}
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
      <Pressable
        onPress={() => (status.playing ? pause() : play())}
        hitSlop={8}
        style={styles.playButton}>
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.text} />
        ) : (
          <PlayPauseIcon playing={status.playing} size={22} color={theme.text} />
        )}
      </Pressable>
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
  playButton: {
    padding: Spacing.two,
  },
});
