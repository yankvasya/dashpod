import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePlayer } from '@/hooks/usePlayer';
import { useQueue } from '@/hooks/useQueue';
import type { QueuedEpisode } from '@/types/podcast';
import { formatDuration, formatProgress } from '@/utils/format';

function toPlayableEpisode(item: QueuedEpisode) {
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

export default function QueueScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { queue, removeEpisode, reorder } = useQueue();
  const { nowPlaying, status, episodeLoading, loadEpisode, play, pause } = usePlayer();

  const upNext = queue.filter((item) => item.episodeId !== nowPlaying?.episode.id);

  async function handlePlayPause(item: QueuedEpisode) {
    if (nowPlaying?.episode.id === item.episodeId) {
      if (status.playing) {
        pause();
      } else {
        play();
      }
    } else {
      removeEpisode(item.episodeId);
      await loadEpisode(toPlayableEpisode(item), item.podcastTitle, item.artworkUrl);
      play();
    }
  }

  function handleViewEpisode(item: QueuedEpisode) {
    if (nowPlaying?.episode.id !== item.episodeId) {
      loadEpisode(toPlayableEpisode(item), item.podcastTitle, item.artworkUrl);
    }
    router.push('/player');
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<QueuedEpisode>) {
    const durationLabel =
      item.playbackPosition > 0 && !item.isFinished && item.durationSeconds > 0
        ? formatProgress(item.playbackPosition, item.durationSeconds)
        : formatDuration(item.durationSeconds);

    return (
      <ScaleDecorator>
        <ThemedView style={styles.row}>
          <Pressable
            onLongPress={drag}
            delayLongPress={150}
            disabled={isActive}
            hitSlop={12}
            style={styles.dragHandle}>
            <SymbolView
              tintColor={theme.textSecondary}
              name={{ ios: 'line.3.horizontal', android: 'drag_handle', web: 'drag_handle' }}
              size={20}
            />
          </Pressable>
          <Pressable style={styles.rowMain} onPress={() => handleViewEpisode(item)}>
            <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
            <ThemedView style={styles.rowText}>
              <ThemedText numberOfLines={1} themeColor="textSecondary" type="small">
                {item.podcastTitle}
              </ThemedText>
              <ThemedText numberOfLines={2}>{item.episodeTitle}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {durationLabel}
              </ThemedText>
            </ThemedView>
          </Pressable>
          <Pressable
            onPress={() => removeEpisode(item.episodeId)}
            hitSlop={8}
            style={styles.deleteButton}>
            <SymbolView
              tintColor={theme.textSecondary}
              name={{ ios: 'trash', android: 'delete', web: 'delete' }}
              size={18}
            />
          </Pressable>
          <EpisodePlayButton
            playing={false}
            loading={false}
            progress={item.durationSeconds > 0 ? item.playbackPosition / item.durationSeconds : 0}
            onPress={() => handlePlayPause(item)}
          />
        </ThemedView>
      </ScaleDecorator>
    );
  }

  const nowPlayingArtwork = nowPlaying
    ? (nowPlaying.episode.artworkUrl ?? nowPlaying.podcastArtworkUrl)
    : null;
  const nowPlayingLoading = episodeLoading || status.isBuffering;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          Queue
        </ThemedText>

        <DraggableFlatList
          data={upNext}
          keyExtractor={(item) => String(item.episodeId)}
          contentContainerStyle={styles.listContent}
          onDragEnd={({ data }) => reorder(data.map((item) => item.episodeId))}
          ListFooterComponent={
            <View style={{ height: BottomTabInset + Spacing.four + (nowPlaying ? MiniPlayerHeight : 0) }} />
          }
          ListHeaderComponent={
            nowPlaying ? (
              <ThemedView style={styles.nowPlayingSection}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                  Now Playing
                </ThemedText>
                <ThemedView style={styles.row}>
                  <ThemedView style={styles.dragHandle} />
                  <Pressable style={styles.rowMain} onPress={() => router.push('/player')}>
                    <Image source={{ uri: nowPlayingArtwork ?? undefined }} style={styles.artwork} />
                    <ThemedView style={styles.rowText}>
                      <ThemedText numberOfLines={1} themeColor="textSecondary" type="small">
                        {nowPlaying.podcastTitle}
                      </ThemedText>
                      <ThemedText numberOfLines={2}>{nowPlaying.episode.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {status.duration > 0 ? formatProgress(status.currentTime, status.duration) : ''}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                  <ThemedView style={styles.deleteButton} />
                  <EpisodePlayButton
                    playing={status.playing}
                    loading={nowPlayingLoading}
                    progress={status.duration > 0 ? status.currentTime / status.duration : 0}
                    onPress={() => (status.playing ? pause() : play())}
                  />
                </ThemedView>
                {upNext.length > 0 && (
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
                    Up Next
                  </ThemedText>
                )}
              </ThemedView>
            ) : null
          }
          ListEmptyComponent={
            !nowPlaying ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Nothing queued yet — add episodes from a podcast's episode list.
              </ThemedText>
            ) : null
          }
          ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
          renderItem={renderItem}
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
  title: {
    fontSize: 32,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  nowPlayingSection: {
    gap: Spacing.two,
  },
  sectionLabel: {
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  dragHandle: {
    padding: Spacing.two,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  deleteButton: {
    padding: Spacing.one,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
