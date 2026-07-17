import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet } from 'react-native';

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

/** Rendered in place within the More tab (not a routed push) — see more.tsx, which swaps this in
 * via local state, same pattern as PodcastDetailView. */
export function HistoryView({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const { days, loading } = useHistory();
  const { nowPlaying } = usePlayer();

  const sections: HistorySection[] = days.map((day) => ({
    title: formatHistoryDay(day.date, t, i18n.language),
    totalMinutes: day.totalMinutes,
    data: day.episodes,
  }));

  return (
    <>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('common.back')}
        </ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>
        {t('history.title')}
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
              {formatDuration(section.totalMinutes * 60, t)}
            </ThemedText>
          </ThemedView>
        )}
        ListEmptyComponent={
          !loading ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('history.empty')}
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
              {formatDuration(item.totalMinutes * 60, t)}
            </ThemedText>
          </ThemedView>
        )}
      />
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
