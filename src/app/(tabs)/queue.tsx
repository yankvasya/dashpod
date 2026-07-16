import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
    fileSizeBytes: null,
  };
}

export default function QueueScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { queue, removeEpisode, markPlayed, reorder, playedFromQueue, clearPlayedFromQueue } = useQueue();
  const { nowPlaying, status, episodeLoading, loadEpisode, play, pause } = usePlayer();
  const [playedCollapsed, setPlayedCollapsed] = useState(false);

  const upNext = queue.filter((item) => item.episodeId !== nowPlaying?.episode.id);
  // If the user jumps back to an episode that's already in "Played" (e.g. via the previous
  // button), it shouldn't show there too while it's the one actively playing below.
  const playedFromQueueVisible = playedFromQueue.filter((item) => item.episodeId !== nowPlaying?.episode.id);

  async function handlePlayPause(item: QueuedEpisode) {
    if (nowPlaying?.episode.id === item.episodeId) {
      if (status.playing) {
        pause();
      } else {
        play();
      }
    } else {
      // markPlayed (not removeEpisode) so it shows up in "Played" — the user is starting this
      // queued episode directly, same as if playback had auto-advanced to it.
      markPlayed(item.episodeId);
      await loadEpisode(toPlayableEpisode(item), item.podcastTitle, item.artworkUrl, item.podcastId);
      play();
    }
  }

  function handleViewEpisode(item: QueuedEpisode) {
    if (nowPlaying?.episode.id !== item.episodeId) {
      loadEpisode(toPlayableEpisode(item), item.podcastTitle, item.artworkUrl, item.podcastId);
    }
    router.push('/player');
  }

  function renderItem({ item, drag, isActive }: RenderItemParams<QueuedEpisode>) {
    const durationLabel =
      item.playbackPosition > 0 && !item.isFinished && item.durationSeconds > 0
        ? formatProgress(item.playbackPosition, item.durationSeconds)
        : formatDuration(item.durationSeconds);
    // Only meaningful right as this row is tapped and playback is switching to it — nowPlaying
    // updates almost immediately, but expo-audio has to actually buffer a remote stream before it
    // starts, and this row's button was never showing that wait at all before.
    const isLoadingThis = nowPlaying?.episode.id === item.episodeId && (episodeLoading || status.isBuffering);

    return (
      <ScaleDecorator>
        <ThemedView style={styles.row}>
          <Pressable
            onLongPress={drag}
            delayLongPress={150}
            disabled={isActive}
            hitSlop={12}
            style={styles.dragHandle}>
            <Ionicons name="reorder-three-outline" color={theme.textSecondary} size={20} />
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
            <Ionicons name="trash-outline" color={theme.textSecondary} size={18} />
          </Pressable>
          <EpisodePlayButton
            playing={false}
            loading={isLoadingThis}
            progress={item.durationSeconds > 0 ? item.playbackPosition / item.durationSeconds : 0}
            onPress={() => handlePlayPause(item)}
          />
        </ThemedView>
      </ScaleDecorator>
    );
  }

  function renderPlayedItem(item: QueuedEpisode) {
    // The currently-playing episode is filtered out of playedFromQueueVisible before this runs,
    // so these rows are always for episodes that aren't the active one.
    const progress = item.durationSeconds > 0 ? item.playbackPosition / item.durationSeconds : 0;

    return (
      <ThemedView key={item.episodeId} style={[styles.row, styles.playedRow]}>
        <ThemedView style={styles.dragHandle} />
        <Pressable style={styles.rowMain} onPress={() => handleViewEpisode(item)}>
          <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
          <ThemedView style={styles.rowText}>
            <ThemedText numberOfLines={1} themeColor="textSecondary" type="small">
              {item.podcastTitle}
            </ThemedText>
            <ThemedText numberOfLines={2}>{item.episodeTitle}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDuration(item.durationSeconds)}
            </ThemedText>
          </ThemedView>
        </Pressable>
        <ThemedView style={styles.deleteButton} />
        <EpisodePlayButton
          playing={false}
          loading={false}
          progress={progress}
          onPress={() => handlePlayPause(item)}
        />
      </ThemedView>
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
            <>
              {playedFromQueueVisible.length > 0 && (
                <ThemedView style={styles.playedSection}>
                  <Pressable
                    onPress={() => setPlayedCollapsed((value) => !value)}
                    style={styles.playedHeader}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Played ({playedFromQueueVisible.length})
                    </ThemedText>
                    <View style={styles.playedHeaderActions}>
                      <Pressable onPress={clearPlayedFromQueue} hitSlop={8}>
                        <ThemedText type="small" themeColor="accent">
                          Clear
                        </ThemedText>
                      </Pressable>
                      <Ionicons
                        name={playedCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'}
                        color={theme.textSecondary}
                        size={16}
                      />
                    </View>
                  </Pressable>
                  {!playedCollapsed && playedFromQueueVisible.map(renderPlayedItem)}
                  <ThemedView type="backgroundElement" style={styles.separator} />
                </ThemedView>
              )}

              {nowPlaying && (
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
              )}
            </>
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
  playedSection: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  playedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  playedHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  playedRow: {
    opacity: 0.5,
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
