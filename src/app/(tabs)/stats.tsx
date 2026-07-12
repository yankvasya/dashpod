import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CalendarMonthGrid } from '@/components/CalendarMonthGrid';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { usePlayer } from '@/hooks/usePlayer';
import { usePodcastListeningStats } from '@/hooks/usePodcastListeningStats';
import { useTheme } from '@/hooks/use-theme';
import type { PodcastListeningStats } from '@/types/podcast';
import { formatDuration } from '@/utils/format';
import { getPeriodLabel, getPeriodRange, shiftPeriod, type Period, type PeriodType } from '@/utils/periods';

const PERIOD_TYPES: { type: PeriodType; label: string }[] = [
  { type: 'day', label: 'Day' },
  { type: 'week', label: 'Week' },
  { type: 'month', label: 'Month' },
  { type: 'year', label: 'Year' },
  { type: 'all', label: 'All' },
];

const CHART_COLORS = ['#6C63FF', '#5AC8FA', '#FF9F43', '#FF6B81', '#2ED9C3', '#FFD166', '#A78BFA', '#4ECDC4'];

export default function StatsScreen() {
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>({ type: 'day', anchor: new Date() });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [expandedPodcastIds, setExpandedPodcastIds] = useState<Set<number>>(new Set());
  const { nowPlaying } = usePlayer();

  const range = useMemo(() => getPeriodRange(period) ?? undefined, [period]);
  const canGoNext = useMemo(() => {
    if (!range) return false;
    return range.endUnixSeconds <= Math.floor(Date.now() / 1000);
  }, [range]);

  const { stats, loading } = usePodcastListeningStats(range);

  const totalMinutes = stats.reduce((sum, item) => sum + item.totalMinutes, 0);
  const pieData = stats.map((item, index) => ({
    value: item.totalMinutes,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));

  function toggleExpanded(podcastId: number) {
    setExpandedPodcastIds((prev) => {
      const next = new Set(prev);
      if (next.has(podcastId)) {
        next.delete(podcastId);
      } else {
        next.add(podcastId);
      }
      return next;
    });
  }

  function renderPodcastRow({ item, index }: { item: PodcastListeningStats; index: number }) {
    const percentage = totalMinutes > 0 ? Math.round((item.totalMinutes / totalMinutes) * 100) : 0;
    const expanded = expandedPodcastIds.has(item.podcastId);
    const listenedEpisodes = item.episodes.filter((episode) => episode.totalMinutes >= 1);

    return (
      <View>
        <Pressable style={styles.row} onPress={() => toggleExpanded(item.podcastId)}>
          <View style={styles.swatchColumn}>
            <View style={[styles.swatch, { backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }]} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.swatchPercent}>
              {percentage}%
            </ThemedText>
          </View>
          <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
          <ThemedView style={styles.rowText}>
            <ThemedText numberOfLines={2}>{item.podcastTitle}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                formatDuration(item.totalMinutes * 60),
                period.type === 'all'
                  ? `${item.finishedEpisodes}/${item.totalEpisodes} episodes`
                  : `${item.episodeCount} episode${item.episodeCount === 1 ? '' : 's'}`,
              ].join(' · ')}
            </ThemedText>
          </ThemedView>
          <SymbolView
            tintColor={theme.textSecondary}
            name={{ ios: expanded ? 'chevron.up' : 'chevron.down', android: 'expand_more', web: 'expand_more' }}
            size={16}
          />
        </Pressable>

        {expanded && (
          <View style={styles.episodeList}>
            {listenedEpisodes.map((episode) => (
              <View key={episode.episodeId} style={styles.episodeRow}>
                <Image source={{ uri: episode.artworkUrl }} style={styles.episodeArtwork} />
                <ThemedText numberOfLines={2} type="small" style={styles.episodeTitle}>
                  {episode.episodeTitle}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDuration(episode.totalMinutes * 60)}
                </ThemedText>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          Stats
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.toggle}>
          {PERIOD_TYPES.map((option) => (
            <Pressable
              key={option.type}
              onPress={() => setPeriod({ type: option.type, anchor: new Date() })}
              style={[
                styles.toggleButton,
                period.type === option.type && { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="smallBold" themeColor={period.type === option.type ? 'text' : 'textSecondary'}>
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </ThemedView>

        {period.type !== 'all' && (
          <ThemedView style={styles.navigator}>
            <Pressable onPress={() => setPeriod(shiftPeriod(period, -1))} hitSlop={8} style={styles.navButton}>
              <ThemedText type="smallBold" themeColor="accent">
                ‹
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => period.type === 'day' && setCalendarVisible(true)}
              disabled={period.type !== 'day'}
              style={styles.navLabel}>
              <ThemedText type="smallBold">{getPeriodLabel(period)}</ThemedText>
              {period.type === 'day' && (
                <SymbolView
                  tintColor={theme.textSecondary}
                  name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }}
                  size={14}
                />
              )}
            </Pressable>
            <Pressable
              onPress={() => canGoNext && setPeriod(shiftPeriod(period, 1))}
              disabled={!canGoNext}
              hitSlop={8}
              style={styles.navButton}>
              <ThemedText type="smallBold" themeColor={canGoNext ? 'accent' : 'textSecondary'}>
                ›
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <FlatList
          data={stats}
          keyExtractor={(item) => String(item.podcastId)}
          contentContainerStyle={[
            styles.listContent,
            nowPlaying && { paddingBottom: BottomTabInset + Spacing.four + MiniPlayerHeight },
          ]}
          ListHeaderComponent={
            pieData.length > 0 ? (
              <View style={styles.chartContainer}>
                <PieChart
                  data={pieData}
                  donut
                  radius={90}
                  innerRadius={60}
                  innerCircleColor={theme.background}
                  centerLabelComponent={() => (
                    <ThemedText type="smallBold" style={styles.chartCenterText}>
                      {formatDuration(totalMinutes * 60)}
                    </ThemedText>
                  )}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Nothing listened to in this period yet.
              </ThemedText>
            ) : null
          }
          ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
          renderItem={renderPodcastRow}
        />

        <CalendarMonthGrid
          visible={calendarVisible}
          selectedDate={period.anchor}
          onSelect={(date) => setPeriod({ type: 'day', anchor: date })}
          onClose={() => setCalendarVisible(false)}
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
  navigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.three,
  },
  navButton: {
    paddingHorizontal: Spacing.two,
  },
  navLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  chartCenterText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  swatchColumn: {
    width: 28,
    alignItems: 'center',
    gap: Spacing.half,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swatchPercent: {
    fontSize: 11,
    lineHeight: 13,
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
    paddingLeft: Spacing.four + 28 + Spacing.three + 48 + Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  episodeArtwork: {
    width: 32,
    height: 32,
    borderRadius: Spacing.one,
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
});
