import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { CalendarMonthGrid } from '@/components/CalendarMonthGrid';
import { ShimmerView } from '@/components/ShimmerView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MiniPlayerHeight, Spacing } from '@/constants/theme';
import { usePlayer } from '@/hooks/usePlayer';
import { usePodcastListeningStats } from '@/hooks/usePodcastListeningStats';
import { useTheme } from '@/hooks/use-theme';
import type { PodcastListeningStats } from '@/types/podcast';
import { formatDuration } from '@/utils/format';
import { getPeriodLabel, getPeriodRange, shiftPeriod, type Period, type PeriodType } from '@/utils/periods';

const CHART_COLORS = ['#6C63FF', '#5AC8FA', '#FF9F43', '#FF6B81', '#2ED9C3', '#FFD166', '#A78BFA', '#4ECDC4'];

/** Rendered in place within the More tab (not a routed push) — see more.tsx, which swaps this in
 * via local state, same pattern as PodcastDetailView. */
export function StatsView({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const PERIOD_TYPES: { type: PeriodType; label: string }[] = [
    { type: 'day', label: t('stats.periodDay') },
    { type: 'week', label: t('stats.periodWeek') },
    { type: 'month', label: t('stats.periodMonth') },
    { type: 'year', label: t('stats.periodYear') },
    { type: 'all', label: t('stats.periodAll') },
  ];
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
  const showSkeleton = loading && stats.length === 0;

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
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} style={styles.swatchPercent}>
              {percentage}%
            </ThemedText>
          </View>
          <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
          <ThemedView style={styles.rowText}>
            <ThemedText numberOfLines={2}>{item.podcastTitle}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {[
                formatDuration(item.totalMinutes * 60, t),
                period.type === 'all'
                  ? t('stats.finishedOf', { finished: item.finishedEpisodes, total: item.totalEpisodes })
                  : t('stats.episodeCount', { count: item.episodeCount }),
              ].join(' · ')}
            </ThemedText>
          </ThemedView>
          <Ionicons
            name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'}
            color={theme.textSecondary}
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
                  {formatDuration(episode.totalMinutes * 60, t)}
                </ThemedText>
              </View>
            ))}
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
        {t('stats.title')}
      </ThemedText>

      <ThemedView type="backgroundElement" style={styles.toggle}>
        {PERIOD_TYPES.map((option) => (
          <Pressable
            key={option.type}
            onPress={() => {
              // Already on this period type — no-op, not even a reset back to "now".
              if (option.type === period.type) return;
              setPeriod({ type: option.type, anchor: new Date() });
            }}
            style={[styles.toggleButton, period.type === option.type && { backgroundColor: theme.backgroundSelected }]}>
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
            <ThemedText type="smallBold">{getPeriodLabel(period, t, i18n.language)}</ThemedText>
            {period.type === 'day' && <Ionicons name="calendar-outline" color={theme.textSecondary} size={14} />}
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

      {showSkeleton ? (
        <View style={styles.listContent}>
          <View style={styles.chartContainer}>
            <ShimmerView style={styles.chartSkeleton} />
          </View>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonStatsRow key={index} />
          ))}
        </View>
      ) : (
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
                    {formatDuration(totalMinutes * 60, t)}
                  </ThemedText>
                )}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('stats.empty')}
            </ThemedText>
          ) : null
        }
        ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
        renderItem={renderPodcastRow}
      />
      )}

      <CalendarMonthGrid
        visible={calendarVisible}
        selectedDate={period.anchor}
        onSelect={(date) => setPeriod({ type: 'day', anchor: date })}
        onClose={() => setCalendarVisible(false)}
      />
    </>
  );
}

function SkeletonStatsRow() {
  return (
    <View style={styles.row}>
      <View style={styles.swatchColumn} />
      <ShimmerView style={styles.artwork} />
      <ThemedView style={styles.rowText}>
        <ShimmerView style={styles.skeletonTitle} />
        <ShimmerView style={styles.skeletonMeta} />
      </ThemedView>
    </View>
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
  chartSkeleton: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  swatchColumn: {
    width: 34,
    height: 48,
  },
  swatch: {
    position: 'absolute',
    top: 20,
    left: '50%',
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swatchPercent: {
    position: 'absolute',
    top: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
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
  skeletonTitle: {
    width: '70%',
    height: 16,
    borderRadius: Spacing.one,
  },
  skeletonMeta: {
    width: '40%',
    height: 12,
    borderRadius: Spacing.one,
  },
  episodeList: {
    paddingLeft: Spacing.four + 34 + Spacing.three,
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
