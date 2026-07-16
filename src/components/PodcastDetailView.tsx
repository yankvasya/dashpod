import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DescriptionText } from '@/components/DescriptionText';
import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { MobileDataDownloadBlockedError, useDownloads } from '@/hooks/useDownloads';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';
import { usePodcastDetail } from '@/hooks/usePodcastDetail';
import { useQueue } from '@/hooks/useQueue';
import type { Episode } from '@/types/podcast';
import { formatDate, formatDuration, formatProgress } from '@/utils/format';

interface PodcastDetailViewProps {
  feedUrl: string;
  onBack: () => void;
}

/** Rendered in place within a tab screen (not a routed push) so the native tab bar underneath
 * never disappears — see index.tsx / my-podcasts.tsx, which swap this in via local state. */
export function PodcastDetailView({ feedUrl, onBack }: PodcastDetailViewProps) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Episode | Omit<Episode, 'id' | 'podcastId'>>>(null);
  const {
    podcast,
    episodes,
    playbackStates,
    isSubscribed,
    loading,
    refreshing,
    subscribing,
    refresh,
    toggleSubscription,
  } = usePodcastDetail(feedUrl);
  const { nowPlaying, status, episodeLoading, loadEpisode, play, pause } = usePlayer();
  const { isDownloaded, getDownloadedUri, downloadingEpisodeIds, downloadEpisode, removeDownload } =
    useDownloads();
  const { isQueued, addEpisode, removeEpisode } = useQueue();

  function resolveForPlayback(episode: (typeof episodes)[number]) {
    const localUri = 'id' in episode && episode.id != null ? getDownloadedUri(episode.id) : null;
    return localUri ? { ...episode, audioUrl: localUri } : episode;
  }

  async function handlePlayPause(episode: (typeof episodes)[number]) {
    if (nowPlaying?.episode.guid === episode.guid) {
      if (status.playing) {
        pause();
      } else {
        play();
      }
    } else if (podcast) {
      await loadEpisode(
        resolveForPlayback(episode),
        podcast.title,
        podcast.artworkUrl,
        'id' in podcast ? podcast.id : null
      );
      play();
    }
  }

  function handleViewEpisode(episode: (typeof episodes)[number]) {
    if (nowPlaying?.episode.guid !== episode.guid && podcast) {
      loadEpisode(
        resolveForPlayback(episode),
        podcast.title,
        podcast.artworkUrl,
        'id' in podcast ? podcast.id : null
      );
    }
    router.push('/player');
  }

  async function handleDownloadPress(episode: Episode) {
    if (isDownloaded(episode.id)) {
      await removeDownload(episode.id);
    } else if (podcast) {
      try {
        await downloadEpisode(episode, podcast.title);
      } catch (error) {
        if (error instanceof MobileDataDownloadBlockedError) {
          Alert.alert('Mobile Data Downloads Off', error.message);
        } else {
          throw error;
        }
      }
    }
  }

  async function handleQueuePress(episode: Episode) {
    if (isQueued(episode.id)) {
      await removeEpisode(episode.id);
    } else {
      await addEpisode(episode.id);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.topBar, { paddingTop: insets.top + Spacing.three }]}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Back
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
          hitSlop={8}
          style={styles.upButton}>
          <Ionicons name="arrow-up-outline" color={theme.textSecondary} size={16} />
          <ThemedText type="smallBold" themeColor="textSecondary">
            Up
          </ThemedText>
        </Pressable>
      </ThemedView>

      <FlatList
        ref={listRef}
        data={episodes}
        keyExtractor={(item) => item.guid}
        contentContainerStyle={[
          styles.listContent,
          nowPlaying && { paddingBottom: BottomTabInset + Spacing.four + MiniPlayerHeight },
        ]}
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
              <DescriptionText html={podcast.description} type="small" themeColor="textSecondary" />
              <Pressable onPress={toggleSubscription} disabled={subscribing} style={styles.subscribeButton}>
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
          const hasId = 'id' in item && item.id != null;
          const savedState = hasId ? playbackStates.get((item as Episode).id) : undefined;
          const progress = isCurrent
            ? status.duration > 0
              ? status.currentTime / status.duration
              : 0
            : savedState && item.durationSeconds > 0
              ? savedState.position / item.durationSeconds
              : 0;
          const isLoading = isCurrent && (episodeLoading || status.isBuffering);
          const isFinished = savedState?.isFinished ?? false;
          const downloaded = hasId && isDownloaded((item as Episode).id);
          const downloading = hasId && downloadingEpisodeIds.has((item as Episode).id);
          const queued = isCurrent || (hasId && isQueued((item as Episode).id));
          const durationLabel =
            isCurrent && status.duration > 0
              ? formatProgress(status.currentTime, status.duration)
              : savedState && savedState.position > 0 && !isFinished && item.durationSeconds > 0
                ? formatProgress(savedState.position, item.durationSeconds)
                : formatDuration(item.durationSeconds);

          return (
            <ThemedView style={[styles.episodeRow, isFinished && styles.episodeRowFinished]}>
              <Pressable style={styles.episodeText} onPress={() => handleViewEpisode(item)}>
                <ThemedText numberOfLines={2}>{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[formatDate(item.publishedAt), durationLabel].filter(Boolean).join(' · ')}
                </ThemedText>
              </Pressable>
              {hasId && (
                <Pressable
                  onPress={() => handleDownloadPress(item as Episode)}
                  disabled={downloading}
                  hitSlop={8}
                  style={[styles.iconButton, { backgroundColor: downloaded ? theme.accent : 'transparent' }]}>
                  {downloading ? (
                    <ActivityIndicator size="small" color={theme.textSecondary} />
                  ) : (
                    <Ionicons
                      name="download-outline"
                      color={downloaded ? theme.background : theme.textSecondary}
                      size={18}
                    />
                  )}
                </Pressable>
              )}
              {hasId && (
                <Pressable
                  onPress={() => handleQueuePress(item as Episode)}
                  hitSlop={8}
                  style={[styles.iconButton, { backgroundColor: queued ? theme.accent : 'transparent' }]}>
                  <Ionicons name="list-outline" color={queued ? theme.background : theme.textSecondary} size={18} />
                </Pressable>
              )}
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
  upButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
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
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  episodeRowFinished: {
    opacity: 0.5,
  },
  episodeText: {
    flex: 1,
    gap: Spacing.half,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
