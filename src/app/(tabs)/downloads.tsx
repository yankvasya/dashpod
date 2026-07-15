import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EpisodePlayButton } from '@/components/player/EpisodePlayButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDownloads } from '@/hooks/useDownloads';
import { usePlayer } from '@/hooks/usePlayer';
import { useQueue } from '@/hooks/useQueue';
import { formatFileSize } from '@/services/downloads';
import type { DownloadedEpisode } from '@/types/podcast';
import { formatDate, formatDuration, formatProgress } from '@/utils/format';

function toPlayableEpisode(item: DownloadedEpisode) {
  return {
    id: item.episodeId,
    guid: item.guid,
    title: item.episodeTitle,
    description: item.description,
    audioUrl: item.localUri,
    durationSeconds: item.durationSeconds,
    publishedAt: item.publishedAt,
    artworkUrl: item.artworkUrl,
  };
}

export default function DownloadsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { downloads, removeDownload, deleteAllListened, deleteAll } = useDownloads();
  const { nowPlaying, status, episodeLoading, loadEpisode, play, pause } = usePlayer();
  const { isQueued, addEpisode, removeEpisode } = useQueue();

  async function handlePlayPause(item: DownloadedEpisode) {
    if (nowPlaying?.episode.id === item.episodeId) {
      if (status.playing) {
        pause();
      } else {
        play();
      }
    } else {
      await loadEpisode(toPlayableEpisode(item), item.podcastTitle, item.artworkUrl);
      play();
    }
  }

  function handleViewEpisode(item: DownloadedEpisode) {
    if (nowPlaying?.episode.id !== item.episodeId) {
      loadEpisode(toPlayableEpisode(item), item.podcastTitle, item.artworkUrl);
    }
    router.push('/player');
  }

  async function handleQueuePress(item: DownloadedEpisode) {
    if (isQueued(item.episodeId)) {
      await removeEpisode(item.episodeId);
    } else {
      await addEpisode(item.episodeId);
    }
  }

  function handleDeletePress() {
    Alert.alert('Delete Downloads', 'Choose what to delete.', [
      { text: 'All Listened', onPress: () => deleteAllListened() },
      {
        text: 'All',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Delete All Downloads',
            `This will permanently delete all ${downloads.length} downloaded episodes. This can't be undone.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete All', style: 'destructive', onPress: () => deleteAll() },
            ]
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={styles.titleRow}>
          <ThemedText type="title" style={styles.title}>
            Downloads
          </ThemedText>
          {downloads.length > 0 && (
            <Pressable onPress={handleDeletePress} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="accent">
                Delete
              </ThemedText>
            </Pressable>
          )}
        </ThemedView>

        <FlatList
          data={downloads}
          keyExtractor={(item) => String(item.episodeId)}
          contentContainerStyle={[
            styles.listContent,
            nowPlaying && { paddingBottom: BottomTabInset + Spacing.four + MiniPlayerHeight },
          ]}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No downloads yet — download an episode to listen offline.
            </ThemedText>
          }
          ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
          renderItem={({ item }) => {
            const isCurrent = nowPlaying?.episode.id === item.episodeId;
            const progress = isCurrent
              ? status.duration > 0
                ? status.currentTime / status.duration
                : 0
              : item.durationSeconds > 0
                ? item.position / item.durationSeconds
                : 0;
            const isLoading = isCurrent && (episodeLoading || status.isBuffering);
            const queued = isCurrent || isQueued(item.episodeId);
            const durationLabel =
              isCurrent && status.duration > 0
                ? formatProgress(status.currentTime, status.duration)
                : item.position > 0 && !item.isFinished && item.durationSeconds > 0
                  ? formatProgress(item.position, item.durationSeconds)
                  : formatDuration(item.durationSeconds);

            return (
              <ThemedView style={[styles.row, item.isFinished && styles.rowFinished]}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => handleViewEpisode(item)}>
                  <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
                  <ThemedView style={styles.rowText}>
                    <ThemedText numberOfLines={1} themeColor="textSecondary" type="small">
                      {item.podcastTitle}
                    </ThemedText>
                    <ThemedText numberOfLines={2}>{item.episodeTitle}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {[durationLabel, formatDate(item.downloadedAt), formatFileSize(item.fileSizeBytes)]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                <Pressable
                  onPress={() => removeDownload(item.episodeId)}
                  hitSlop={8}
                  style={styles.deleteButton}>
                  <Ionicons name="trash-outline" color={theme.textSecondary} size={18} />
                </Pressable>
                <Pressable
                  onPress={() => handleQueuePress(item)}
                  hitSlop={8}
                  style={styles.queueButton}>
                  <Ionicons
                    name={queued ? 'checkmark-circle' : 'add-circle-outline'}
                    color={queued ? theme.accent : theme.textSecondary}
                    size={18}
                  />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  rowFinished: {
    opacity: 0.5,
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
  queueButton: {
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
