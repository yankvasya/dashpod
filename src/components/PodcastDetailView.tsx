import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { DescriptionText } from '@/components/DescriptionText';
import { EpisodeDetailSheet } from '@/components/EpisodeDetailSheet';
import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { ShimmerView } from '@/components/ShimmerView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { MobileDataDownloadBlockedError, useDownloads } from '@/hooks/useDownloads';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';
import { usePodcastDetail } from '@/hooks/usePodcastDetail';
import { useQueue } from '@/hooks/useQueue';
import { formatFileSize } from '@/services/downloads';
import type { Episode } from '@/types/podcast';
import { formatDate, formatDuration, formatProgress } from '@/utils/format';

interface PodcastDetailViewProps {
  feedUrl: string;
  onBack: () => void;
}

// Scroll range (px) over which the compact header fades in, roughly matching where the full
// artwork+title block scrolls out from under the top bar.
const COLLAPSE_START = 150;
const COLLAPSE_END = 210;

/** Rendered in place within a tab screen (not a routed push) so the native tab bar underneath
 * never disappears — see index.tsx / my-podcasts.tsx, which swap this in via local state. */
export function PodcastDetailView({ feedUrl, onBack }: PodcastDetailViewProps) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
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
  const { nowPlaying, status, episodeLoading, loadEpisode, play, pause, expandPlayer } = usePlayer();
  const { isDownloaded, getDownloadedUri, downloadingEpisodeIds, downloadEpisode, removeDownload } =
    useDownloads();
  const { isQueued, addEpisode, removeEpisode } = useQueue();
  const [detailEpisode, setDetailEpisode] = useState<(typeof episodes)[number] | null>(null);
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  // Collapsing header: as the full artwork/title block scrolls off, a compact title (with mini
  // artwork) fades in between the Back and Up buttons — iOS Music-style. Kept as a plain opacity
  // fade tied to scroll position on the UI thread (not React state) so it tracks the gesture
  // directly instead of lagging a frame behind.
  const compactHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [6, 0], Extrapolation.CLAMP) },
    ],
  }));
  // Up only makes sense once the header has collapsed far enough that scrolling back to the top
  // isn't already obvious/one swipe away — fades in together with the compact title.
  const upButtonStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));

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
    setDetailEpisode(episode);
  }

  function handleOpenPlayer(episode: (typeof episodes)[number]) {
    if (nowPlaying?.episode.guid !== episode.guid && podcast) {
      loadEpisode(
        resolveForPlayback(episode),
        podcast.title,
        podcast.artworkUrl,
        'id' in podcast ? podcast.id : null
      );
    }
    setDetailEpisode(null);
    expandPlayer();
  }

  async function handleDownloadPress(episode: Episode) {
    if (isDownloaded(episode.id)) {
      await removeDownload(episode.id);
    } else if (podcast) {
      try {
        await downloadEpisode(episode, podcast.title);
      } catch (error) {
        if (error instanceof MobileDataDownloadBlockedError) {
          Alert.alert(t('podcastDetail.mobileDataBlockedTitle'), t('podcastDetail.mobileDataBlockedMessage'));
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

  // Only true on the very first load of a podcast that isn't cached locally yet (e.g. opened
  // straight from search) — refreshes of an already-subscribed podcast keep showing the existing
  // list instead of clearing it out from under the user.
  const showSkeleton = loading && !podcast && episodes.length === 0;

  const detailIsCurrent = detailEpisode ? nowPlaying?.episode.guid === detailEpisode.guid : false;
  const detailSavedState =
    detailEpisode && 'id' in detailEpisode && detailEpisode.id != null
      ? playbackStates.get(detailEpisode.id)
      : undefined;
  const detailProgress = detailIsCurrent
    ? status.duration > 0
      ? status.currentTime / status.duration
      : 0
    : detailSavedState && detailEpisode && detailEpisode.durationSeconds > 0
      ? detailSavedState.position / detailEpisode.durationSeconds
      : 0;

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={[styles.topBar, { paddingTop: insets.top + Spacing.three }]}>
        <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('common.back')}
          </ThemedText>
        </Pressable>
        <Reanimated.View style={[styles.compactHeader, compactHeaderStyle]} pointerEvents="none">
          {podcast && (
            <>
              <Image source={{ uri: podcast.artworkUrl }} style={styles.compactArtwork} />
              <ThemedText type="smallBold" numberOfLines={1} style={styles.compactTitle}>
                {podcast.title}
              </ThemedText>
            </>
          )}
        </Reanimated.View>
        <Reanimated.View style={upButtonStyle}>
          <Pressable
            onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
            hitSlop={8}
            style={styles.upButton}>
            <Ionicons name="arrow-up-outline" color={theme.textSecondary} size={16} />
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('podcastDetail.up')}
            </ThemedText>
          </Pressable>
        </Reanimated.View>
      </ThemedView>

      {showSkeleton ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <SkeletonHeader />
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonEpisodeRow key={index} />
          ))}
        </ScrollView>
      ) : (
        <Reanimated.FlatList
        ref={listRef}
        data={episodes}
        keyExtractor={(item) => item.guid}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
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
                  <>
                    <Ionicons
                      name={isSubscribed ? 'checkmark-circle' : 'add-circle-outline'}
                      color={theme.accent}
                      size={18}
                    />
                    <ThemedText type="smallBold" themeColor="accent">
                      {isSubscribed ? t('podcastDetail.removeFromMyPodcasts') : t('podcastDetail.addToMyPodcasts')}
                    </ThemedText>
                  </>
                )}
              </Pressable>
              <ThemedText type="smallBold" style={styles.episodesLabel}>
                {t('podcastDetail.episodes')}
              </ThemedText>
            </ThemedView>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('podcastDetail.noEpisodes')}
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
              ? formatProgress(status.currentTime, status.duration, t)
              : savedState && savedState.position > 0 && !isFinished && item.durationSeconds > 0
                ? formatProgress(savedState.position, item.durationSeconds, t)
                : formatDuration(item.durationSeconds, t);

          return (
            <ThemedView style={[styles.episodeRow, isFinished && styles.episodeRowFinished]}>
              <Pressable style={styles.episodeText} onPress={() => handleViewEpisode(item)}>
                <ThemedText numberOfLines={2}>{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    formatDate(item.publishedAt, i18n.language),
                    durationLabel,
                    !downloaded && item.fileSizeBytes ? formatFileSize(item.fileSizeBytes) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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
      )}

      <EpisodeDetailSheet
        visible={detailEpisode != null}
        episode={
          detailEpisode
            ? {
                title: detailEpisode.title,
                podcastTitle: podcast?.title ?? '',
                artworkUrl: detailEpisode.artworkUrl ?? podcast?.artworkUrl ?? null,
                description: detailEpisode.description,
                durationSeconds: detailEpisode.durationSeconds,
                publishedAt: detailEpisode.publishedAt,
              }
            : null
        }
        playing={detailIsCurrent && status.playing}
        loading={detailIsCurrent && (episodeLoading || status.isBuffering)}
        progress={detailProgress}
        onPlayPause={() => detailEpisode && handlePlayPause(detailEpisode)}
        onOpenPlayer={() => detailEpisode && handleOpenPlayer(detailEpisode)}
        onClose={() => setDetailEpisode(null)}
      />
    </ThemedView>
  );
}

function SkeletonHeader() {
  return (
    <ThemedView style={styles.header}>
      <ShimmerView style={styles.artwork} />
      <ShimmerView style={styles.skeletonTitle} />
      <ShimmerView style={styles.skeletonAuthor} />
      <ShimmerView style={styles.skeletonDescriptionLine} />
      <ShimmerView style={[styles.skeletonDescriptionLine, styles.skeletonDescriptionLineShort]} />
      <ShimmerView style={styles.skeletonButton} />
    </ThemedView>
  );
}

function SkeletonEpisodeRow() {
  return (
    <ThemedView style={styles.episodeRow}>
      <ThemedView style={styles.episodeText}>
        <ShimmerView style={styles.skeletonEpisodeTitle} />
        <ShimmerView style={styles.skeletonEpisodeMeta} />
      </ThemedView>
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
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  backButton: {
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  compactHeader: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  compactArtwork: {
    width: 24,
    height: 24,
    borderRadius: Spacing.half,
  },
  compactTitle: {
    flexShrink: 1,
  },
  upButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    flexShrink: 0,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  episodesLabel: {
    alignSelf: 'flex-start',
    marginTop: Spacing.two,
  },
  skeletonTitle: {
    width: 200,
    height: 24,
    borderRadius: Spacing.one,
  },
  skeletonAuthor: {
    width: 140,
    height: 16,
    borderRadius: Spacing.one,
  },
  skeletonDescriptionLine: {
    alignSelf: 'stretch',
    height: 12,
    borderRadius: Spacing.one,
  },
  skeletonDescriptionLineShort: {
    alignSelf: 'center',
    width: '70%',
  },
  skeletonButton: {
    width: 180,
    height: 20,
    borderRadius: Spacing.one,
    marginVertical: Spacing.one,
  },
  skeletonEpisodeTitle: {
    width: '90%',
    height: 16,
    borderRadius: Spacing.one,
  },
  skeletonEpisodeMeta: {
    width: '45%',
    height: 12,
    borderRadius: Spacing.one,
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
