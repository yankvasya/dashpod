import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PRESET_MINUTES = [5, 10, 15, 30, 45, 60];

export function formatSleepTimerRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

interface SleepTimerModalProps {
  visible: boolean;
  mode: 'off' | 'duration' | 'endOfEpisode';
  onSelectMinutes: (minutes: number) => void;
  onSelectEndOfEpisode: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function SleepTimerModal({
  visible,
  mode,
  onSelectMinutes,
  onSelectEndOfEpisode,
  onCancel,
  onClose,
}: SleepTimerModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="subtitle" style={styles.centerText}>
              Sleep Timer
            </ThemedText>

            <View style={styles.presetsRow}>
              {PRESET_MINUTES.map((minutes) => (
                <Pressable
                  key={minutes}
                  onPress={() => onSelectMinutes(minutes)}
                  style={[styles.presetButton, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText type="smallBold">{minutes} min</ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={onSelectEndOfEpisode}
              style={[
                styles.optionRow,
                { backgroundColor: mode === 'endOfEpisode' ? theme.accent : theme.backgroundElement },
              ]}>
              <ThemedText type="smallBold" themeColor={mode === 'endOfEpisode' ? 'background' : 'text'}>
                End of Episode
              </ThemedText>
            </Pressable>

            {mode !== 'off' && (
              <Pressable onPress={onCancel} style={styles.optionRow}>
                <ThemedText type="smallBold" themeColor="accent">
                  Turn Off Sleep Timer
                </ThemedText>
              </Pressable>
            )}

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
  centerText: {
    textAlign: 'center',
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  presetButton: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
  },
  optionRow: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  doneButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
