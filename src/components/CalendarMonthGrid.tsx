import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <ThemedView style={styles.sheet}>
            <View style={styles.monthNav}>
              <Pressable
                onPress={() =>
                  setDisplayedMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1))
                }
                hitSlop={8}>
                <ThemedText type="smallBold" themeColor="accent">
                  ‹
                </ThemedText>
              </Pressable>
              <ThemedText type="smallBold">
                {displayedMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </ThemedText>
              <Pressable
                onPress={() =>
                  setDisplayedMonth(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1))
                }
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
                return (
                  <Pressable
                    key={index}
                    onPress={() => !isFuture && handleSelect(date)}
                    disabled={isFuture}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: theme.accent },
                      isToday && !isSelected && [styles.todayOutline, { borderColor: theme.accent }],
                    ]}>
                    <ThemedText
                      type="small"
                      themeColor={isSelected ? 'background' : isFuture ? 'textSecondary' : 'text'}
                      style={isFuture && styles.dimmedText}>
                      {date.getDate()}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <Pressable onPress={onClose} style={styles.doneButton}>
              <ThemedText type="smallBold" themeColor="accent">
                Done
              </ThemedText>
            </Pressable>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    padding: Spacing.five,
    gap: Spacing.three,
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
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  todayOutline: {
    borderWidth: 1,
  },
  dimmedText: {
    opacity: 0.4,
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
