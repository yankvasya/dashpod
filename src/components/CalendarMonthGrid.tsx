import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ModalSheet } from '@/components/ModalSheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useHistory } from '@/hooks/useHistory';
import { useTheme } from '@/hooks/use-theme';
import { formatDuration, formatDurationCompact } from '@/utils/format';
import { formatLocalDate, getPeriodRange } from '@/utils/periods';

const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface CalendarMonthGridProps {
  visible: boolean;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/** Bottom-sheet month grid for jumping to an arbitrary day, in place of a native date picker
 * (no calendar/date-picker dependency in this project — see SpeedModal.tsx for the same
 * scrim+sheet pattern used elsewhere). */
export function CalendarMonthGrid({ visible, selectedDate, onSelect, onClose }: CalendarMonthGridProps) {
  const theme = useTheme();
  const [displayedMonth, setDisplayedMonth] = useState(
    new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );

  useEffect(() => {
    if (visible) {
      setDisplayedMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    }
  }, [visible, selectedDate]);

  const monthRange = useMemo(() => getPeriodRange({ type: 'month', anchor: displayedMonth }) ?? undefined, [
    displayedMonth,
  ]);
  const { days } = useHistory(monthRange);
  const dailyTotals = useMemo(() => new Map(days.map((day) => [day.date, day.totalMinutes])), [days]);
  const monthTotalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);

  const today = startOfDay(new Date());
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const leadingBlanks = (displayedMonth.getDay() + 6) % 7; // Monday-start

  const cells: (Date | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), i + 1)
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function handleSelect(date: Date) {
    onSelect(date);
    onClose();
  }

  return (
    <ModalSheet visible={visible} onClose={onClose} contentStyle={styles.sheet}>
      {monthTotalMinutes > 0 && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.monthTotal}>
          {formatDuration(monthTotalMinutes * 60)} listened this month
        </ThemedText>
      )}

      <View style={styles.monthNav}>
        <Pressable
          onPress={() => setDisplayedMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1))}
          hitSlop={8}>
          <ThemedText type="smallBold" themeColor="accent">
            ‹
          </ThemedText>
        </Pressable>
        <ThemedText type="smallBold">
          {displayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </ThemedText>
        <Pressable
          onPress={() => setDisplayedMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1))}
          hitSlop={8}>
          <ThemedText type="smallBold" themeColor="accent">
            ›
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.weekdayLabel}>
            {label}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date, index) => {
          if (!date) return <View key={index} style={styles.dayCell} />;
          const isToday = isSameDay(date, today);
          const isSelected = isSameDay(date, selectedDate);
          const isFuture = date.getTime() > today.getTime();
          const totalMinutes = dailyTotals.get(formatLocalDate(date)) ?? 0;

          return (
            <Pressable
              key={index}
              onPress={() => !isFuture && handleSelect(date)}
              disabled={isFuture}
              style={styles.dayCell}>
              <View
                style={[
                  styles.dayNumberWrap,
                  isSelected && { backgroundColor: theme.accent },
                  isToday && !isSelected && { borderColor: theme.accent },
                ]}>
                <ThemedText
                  type="small"
                  themeColor={isSelected ? 'background' : isFuture ? 'textSecondary' : 'text'}
                  style={isFuture && styles.dimmedText}>
                  {date.getDate()}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={styles.dayCaption}>
                {totalMinutes >= 1 ? formatDurationCompact(totalMinutes * 60) : ''}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: Spacing.three,
  },
  monthTotal: {
    textAlign: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dimmedText: {
    opacity: 0.4,
  },
  dayCaption: {
    fontSize: 9,
    lineHeight: 11,
  },
});
