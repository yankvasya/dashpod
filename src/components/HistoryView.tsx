import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, SectionList, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, FontFamily, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { days, loading } = useHistory();
  const { nowPlaying } = usePlayer();
  const [query, setQuery] = useState('');
  const [onlyFinished, setOnlyFinished] = useState(false);

  const isFiltering = query.trim().length > 0 || onlyFinished;

  const sections: HistorySection[] = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return days
      .map((day) => {
        const episodes = day.episodes.filter((episode) => {
          if (onlyFinished && !episode.isFinished) return false;
          if (!needle) return true;
          return (
            episode.episodeTitle.toLowerCase().includes(needle) ||
            episode.podcastTitle.toLowerCase().includes(needle)
          );
        });
        return {
          title: formatHistoryDay(day.date, t, i18n.language),
          totalMinutes: episodes.reduce((sum, episode) => sum + episode.totalMinutes, 0),
          data: episodes,
        };
      })
      .filter((section) => section.data.length > 0);
  }, [days, query, onlyFinished, t, i18n.language]);

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

      <ThemedView style={styles.filterBar}>
        <ThemedView type="backgroundElement" style={styles.searchRow}>
          <Ionicons name="search" size={16} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('history.searchPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </ThemedView>

        <Pressable
          onPress={() => setOnlyFinished((value) => !value)}
          style={[
            styles.filterChip,
            { backgroundColor: onlyFinished ? theme.accent : theme.backgroundElement },
          ]}>
          <Ionicons
            name={onlyFinished ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={16}
            color={onlyFinished ? theme.background : theme.textSecondary}
          />
          <ThemedText
            type="small"
            style={{ color: onlyFinished ? theme.background : theme.text }}>
            {t('history.onlyFinished')}
          </ThemedText>
        </Pressable>
      </ThemedView>

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
              {isFiltering ? t('history.noResults') : t('history.empty')}
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
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    // Android's TextInput carries built-in EditText padding that iOS's equivalent doesn't have,
    // making the same layout look wider/taller there. Zero it so both platforms match.
    padding: 0,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
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
