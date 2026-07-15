import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { useHistory } from '@/hooks/useHistory';
import { usePlayer } from '@/hooks/usePlayer';
import type { EpisodeListeningSummary } from '@/types/podcast';
import { formatDuration, formatHistoryDay } from '@/utils/format';

interface HistorySection {
  title: string;
  totalMinutes: number;
  data: EpisodeListeningSummary[];
}

export default function HistoryScreen() {
  const { days, loading } = useHistory();
  const { nowPlaying } = usePlayer();

  const sections: HistorySection[] = days.map((day) => ({
    title: formatHistoryDay(day.date),
    totalMinutes: day.totalMinutes,
    data: day.episodes,
  }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Back
          </ThemedText>
        </Pressable>

        <ThemedText type="title" style={styles.title}>
          History
        </ThemedText>

        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.episodeId}-${index}`}
          contentContainerStyle={[
            styles.listContent,
            nowPlaying && { paddingBottom: BottomTabInset + Spacing.four + MiniPlayerHeight },
          ]}
          renderSectionHeader={({ section }) => (
            <ThemedView style={styles.sectionHeader}>
              <ThemedText type="smallBold">{section.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatDuration(section.totalMinutes * 60)}
              </ThemedText>
            </ThemedView>
          )}
          ListEmptyComponent={
            !loading ? (
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
  backButton: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
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
