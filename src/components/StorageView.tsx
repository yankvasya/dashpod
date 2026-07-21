import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useDownloads } from '@/hooks/useDownloads';
import { useTheme } from '@/hooks/use-theme';
import { formatFileSize } from '@/services/downloads';
import type { DownloadedEpisode } from '@/types/podcast';

const CHART_COLORS = ['#6C63FF', '#5AC8FA', '#FF9F43', '#FF6B81', '#2ED9C3', '#FFD166', '#A78BFA', '#4ECDC4'];

interface PodcastGroup {
  podcastId: number;
  podcastTitle: string;
  artworkUrl: string;
  episodes: DownloadedEpisode[];
  totalBytes: number;
}

/** Dedicated storage-management screen, reached from the Downloads tab's storage summary row —
 * supersedes the old plain "list of podcasts and their sizes" modal with a real chart plus the
 * ability to select individual episodes (or a whole podcast at once) for a custom bulk delete,
 * not just the existing "all" / "only listened" shortcuts. Rendered in place within the Downloads
 * tab (not a routed push), same local-state + onBack pattern as HistoryView/StatsView/
 * SettingsView/PodcastDetailView. */
export function StorageView({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { downloads, removeDownload } = useDownloads();
  const [expandedPodcastIds, setExpandedPodcastIds] = useState<Set<number>>(new Set());
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const podcastGroups = useMemo(() => {
    const byPodcast = new Map<number, PodcastGroup>();
    for (const item of downloads) {
      const existing = byPodcast.get(item.podcastId);
      if (existing) {
        existing.episodes.push(item);
        existing.totalBytes += item.fileSizeBytes;
      } else {
        byPodcast.set(item.podcastId, {
          podcastId: item.podcastId,
          podcastTitle: item.podcastTitle,
          artworkUrl: item.artworkUrl,
          episodes: [item],
          totalBytes: item.fileSizeBytes,
        });
      }
    }
    return Array.from(byPodcast.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }, [downloads]);

  const allBytes = downloads.reduce((sum, item) => sum + item.fileSizeBytes, 0);
  const pieData = podcastGroups.map((group, index) => ({
    value: group.totalBytes,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
  const selectedBytes = downloads
    .filter((item) => selectedEpisodeIds.has(item.episodeId))
    .reduce((sum, item) => sum + item.fileSizeBytes, 0);

  function toggleExpanded(podcastId: number) {
    setExpandedPodcastIds((prev) => {
      const next = new Set(prev);
      if (next.has(podcastId)) next.delete(podcastId);
      else next.add(podcastId);
      return next;
    });
  }

  function toggleEpisode(episodeId: number) {
    setSelectedEpisodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(episodeId)) next.delete(episodeId);
      else next.add(episodeId);
      return next;
    });
  }

  function togglePodcast(group: PodcastGroup) {
    setSelectedEpisodeIds((prev) => {
      const next = new Set(prev);
      const allSelected = group.episodes.every((episode) => next.has(episode.episodeId));
      for (const episode of group.episodes) {
        if (allSelected) next.delete(episode.episodeId);
        else next.add(episode.episodeId);
      }
      return next;
    });
  }

  async function handleDeleteSelected() {
    setDeleting(true);
    try {
      // Sequential, not Promise.all — each removeDownload call reads the current `downloads`
      // snapshot to locate the file to delete off disk; keeping them sequential avoids any of
      // them racing against a stale closure from an in-flight sibling call.
      for (const episodeId of selectedEpisodeIds) {
        await removeDownload(episodeId);
      }
      setSelectedEpisodeIds(new Set());
    } finally {
      setDeleting(false);
    }
  }

  function renderPodcastGroup({ item: group }: { item: PodcastGroup }) {
    const expanded = expandedPodcastIds.has(group.podcastId);
    const allSelected = group.episodes.every((episode) => selectedEpisodeIds.has(episode.episodeId));
    const someSelected = !allSelected && group.episodes.some((episode) => selectedEpisodeIds.has(episode.episodeId));

    return (
      <View>
        <View style={styles.row}>
          <Pressable onPress={() => togglePodcast(group)} hitSlop={8} style={styles.checkbox}>
            <Ionicons
              name={allSelected ? 'checkbox' : someSelected ? 'remove-circle' : 'square-outline'}
              color={allSelected || someSelected ? theme.accent : theme.textSecondary}
              size={22}
            />
          </Pressable>
          <Pressable style={styles.rowMain} onPress={() => toggleExpanded(group.podcastId)}>
            <Image source={{ uri: group.artworkUrl }} style={styles.artwork} />
            <ThemedView style={styles.rowText}>
              <ThemedText numberOfLines={2}>{group.podcastTitle}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('downloads.episodeCount', { count: group.episodes.length })} · {formatFileSize(group.totalBytes)}
              </ThemedText>
            </ThemedView>
            <Ionicons
              name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
              color={theme.textSecondary}
              size={16}
            />
          </Pressable>
        </View>

        {expanded && (
          <View style={styles.episodeList}>
            {group.episodes.map((episode) => {
              const episodeSelected = selectedEpisodeIds.has(episode.episodeId);
              return (
                <Pressable
                  key={episode.episodeId}
                  style={styles.episodeRow}
                  onPress={() => toggleEpisode(episode.episodeId)}>
                  <Ionicons
                    name={episodeSelected ? 'checkbox' : 'square-outline'}
                    color={episodeSelected ? theme.accent : theme.textSecondary}
                    size={20}
                  />
                  <ThemedText numberOfLines={2} type="small" style={styles.episodeTitle}>
                    {episode.episodeTitle}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatFileSize(episode.fileSizeBytes)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  return (
    <>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('common.back')}
        </ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>
        {t('downloads.storageTitle')}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
        {t('downloads.storageTotal', { count: downloads.length, size: formatFileSize(allBytes) })}
      </ThemedText>

      <FlatList
        data={podcastGroups}
        keyExtractor={(item) => String(item.podcastId)}
        contentContainerStyle={[styles.listContent, selectedEpisodeIds.size > 0 && styles.listContentWithActionBar]}
        ListHeaderComponent={
          pieData.length > 0 ? (
            <View style={styles.chartContainer}>
              <PieChart
                data={pieData}
                donut
                radius={80}
                innerRadius={54}
                innerCircleColor={theme.background}
                centerLabelComponent={() => (
                  <ThemedText type="smallBold" style={styles.chartCenterText}>
                    {formatFileSize(allBytes)}
                  </ThemedText>
                )}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            {t('downloads.empty')}
          </ThemedText>
        }
        ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
        renderItem={renderPodcastGroup}
      />

      {selectedEpisodeIds.size > 0 && (
        <ThemedView type="backgroundElement" style={[styles.actionBar, { paddingBottom: BottomTabInset }]}>
          <Pressable onPress={() => setSelectedEpisodeIds(new Set())} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('common.cancel')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleDeleteSelected}
            disabled={deleting}
            style={[styles.deleteSelectedButton, { backgroundColor: theme.danger, opacity: deleting ? 0.6 : 1 }]}>
            <Ionicons name="trash-outline" color="#FFFFFF" size={16} />
            <ThemedText type="smallBold" style={styles.whiteText}>
              {t('downloads.deleteSelected', { count: selectedEpisodeIds.size, size: formatFileSize(selectedBytes) })}
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
  },
  subtitle: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  chartCenterText: {
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  listContentWithActionBar: {
    paddingBottom: Spacing.five * 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  checkbox: {
    padding: Spacing.one,
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
  episodeList: {
    paddingLeft: Spacing.four + 22 + Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  episodeTitle: {
    flex: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  deleteSelectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  whiteText: {
    color: '#FFFFFF',
  },
});
