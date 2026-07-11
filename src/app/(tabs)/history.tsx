import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { useHistory } from '@/hooks/useHistory';
import { usePlayer } from '@/hooks/usePlayer';
import { usePodcastListeningStats } from '@/hooks/usePodcastListeningStats';
import { useTheme } from '@/hooks/use-theme';
import type { EpisodeListeningSummary } from '@/types/podcast';
import { formatDuration, formatHistoryDay } from '@/utils/format';

interface HistorySection {
  title: string;
  totalMinutes: number;
  data: EpisodeListeningSummary[];
}

type ViewMode = 'daily' | 'podcast';

export default function HistoryScreen() {
  const theme = useTheme();
  const { days, loading: historyLoading } = useHistory();
  const { stats, loading: statsLoading } = usePodcastListeningStats();
  const { nowPlaying } = usePlayer();
  const [view, setView] = useState<ViewMode>('daily');

  const sections: HistorySection[] = days.map((day) => ({
    title: formatHistoryDay(day.date),
    totalMinutes: day.totalMinutes,
    data: day.episodes,
  }));

  const listContentStyle = [
    styles.listContent,
    nowPlaying ? { paddingBottom: BottomTabInset + Spacing.four + MiniPlayerHeight } : null,
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          History
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.toggle}>
          <Pressable
            onPress={() => setView('daily')}
            style={[styles.toggleButton, view === 'daily' && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor={view === 'daily' ? 'text' : 'textSecondary'}>
              Daily
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setView('podcast')}
            style={[styles.toggleButton, view === 'podcast' && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor={view === 'podcast' ? 'text' : 'textSecondary'}>
              By Podcast
            </ThemedText>
          </Pressable>
        </ThemedView>

        {view === 'daily' ? (
          <SectionList
            sections={sections}
            keyExtractor={(item, index) => `${item.episodeId}-${index}`}
            contentContainerStyle={listContentStyle}
            renderSectionHeader={({ section }) => (
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="smallBold">{section.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(section.totalMinutes * 60)}
                </ThemedText>
              </ThemedView>
            )}
            ListEmptyComponent={
              !historyLoading ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  No listening history yet — start playing an episode to see it here.
                </ThemedText>
              ) : null
            }
            ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
            renderItem={({ item }) => (
              <ThemedView style={styles.row}>
                <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
                <ThemedView style={styles.rowText}>
                  <ThemedText numberOfLines={1} themeColor="textSecondary" type="small">
                    {item.podcastTitle}
                  </ThemedText>
                  <ThemedText numberOfLines={2}>{item.episodeTitle}</ThemedText>
                </ThemedView>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(item.totalMinutes * 60)}
                </ThemedText>
              </ThemedView>
            )}
          />
        ) : (
          <FlatList
            data={stats}
            keyExtractor={(item) => String(item.podcastId)}
            contentContainerStyle={listContentStyle}
            ListEmptyComponent={
              !statsLoading ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  No listening history yet — start playing an episode to see it here.
                </ThemedText>
              ) : null
            }
            ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
            renderItem={({ item }) => (
              <ThemedView style={styles.row}>
                <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
                <ThemedView style={styles.rowText}>
                  <ThemedText numberOfLines={2}>{item.podcastTitle}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {[
                      formatDuration(item.totalMinutes * 60),
                      `${item.finishedEpisodes}/${item.totalEpisodes} episodes`,
                    ].join(' · ')}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            )}
          />
        )}
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
  toggle: {
    flexDirection: 'row',
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.half,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
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
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
