import { Image } from 'expo-image';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { usePlayer } from '@/hooks/usePlayer';
import { usePodcastDetail } from '@/hooks/usePodcastDetail';

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function PodcastDetailScreen() {
  const { feedUrl } = useLocalSearchParams<{ feedUrl: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { podcast, episodes, isSubscribed, loading, refreshing, subscribing, refresh, toggleSubscription } =
    usePodcastDetail(feedUrl);
  const { nowPlaying, status, episodeLoading, loadEpisode, play, pause } = usePlayer();

  useEffect(() => {
    if (podcast) {
      navigation.setOptions({ title: podcast.title });
    }
  }, [navigation, podcast]);

  async function handlePlayPause(episode: (typeof episodes)[number]) {
    if (nowPlaying?.episode.guid === episode.guid) {
      if (status.playing) {
        pause();
      } else {
        play();
      }
    } else if (podcast) {
      await loadEpisode(episode, podcast.title, podcast.artworkUrl);
      play();
    }
  }

  function handleViewEpisode(episode: (typeof episodes)[number]) {
    if (nowPlaying?.episode.guid !== episode.guid && podcast) {
      loadEpisode(episode, podcast.title, podcast.artworkUrl);
    }
    router.push('/player');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <FlatList
          data={episodes}
          keyExtractor={(item) => item.guid}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
          ListHeaderComponent={
            podcast ? (
              <ThemedView style={styles.header}>
                <Image source={{ uri: podcast.artworkUrl }} style={styles.artwork} />
                <ThemedText type="subtitle" style={styles.centerText}>
                  {podcast.title}
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.centerText}>
                  {podcast.author}
                </ThemedText>
                {podcast.description ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {podcast.description}
                  </ThemedText>
                ) : null}
                <Pressable
                  onPress={toggleSubscription}
                  disabled={subscribing}
                  style={styles.subscribeButton}>
                  {subscribing ? (
                    <ActivityIndicator />
                  ) : (
                    <ThemedText type="smallBold" themeColor="accent">
                      {isSubscribed ? 'Remove from My Podcasts' : 'Add to My Podcasts'}
                    </ThemedText>
                  )}
                </Pressable>
                <ThemedText type="smallBold" style={styles.episodesLabel}>
                  Episodes
                </ThemedText>
              </ThemedView>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No episodes found.
              </ThemedText>
            ) : null
          }
          ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
          renderItem={({ item }) => {
            const isCurrent = nowPlaying?.episode.guid === item.guid;
            const progress =
              isCurrent && status.duration > 0 ? status.currentTime / status.duration : 0;
            const isLoading = isCurrent && (episodeLoading || status.isBuffering);
            return (
              <ThemedView style={styles.episodeRow}>
                <Pressable style={styles.episodeText} onPress={() => handleViewEpisode(item)}>
                  <ThemedText numberOfLines={2}>{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[formatDate(item.publishedAt), formatDuration(item.durationSeconds)]
                      .filter(Boolean)
                      .join(' · ')}
                  </ThemedText>
                </Pressable>
                <EpisodePlayButton
                  playing={isCurrent && status.playing}
                  loading={isLoading}
                  progress={progress}
                  onPress={() => handlePlayPause(item)}
                />
              </ThemedView>
            );
          }}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.four,
  },
  artwork: {
    width: 160,
    height: 160,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  centerText: {
    textAlign: 'center',
  },
  subscribeButton: {
    paddingVertical: Spacing.two,
  },
  episodesLabel: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  episodeText: {
    flex: 1,
    gap: Spacing.half,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
