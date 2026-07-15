import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ModalSheet } from '@/components/ModalSheet';
import { ThemedText } from '@/components/themed-text';
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
    <ModalSheet visible={visible} onClose={onClose} contentStyle={styles.sheet}>
      <ThemedText type="subtitle" style={styles.centerText}>
        Sleep Timer
      </ThemedText>

      <View style={styles.grid}>
        {PRESET_MINUTES.map((minutes) => (
          <Pressable
            key={minutes}
            onPress={() => onSelectMinutes(minutes)}
            style={[styles.gridButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">{minutes} min</ThemedText>
          </Pressable>
        ))}
      </View>

      <Pressable
        onPress={onSelectEndOfEpisode}
        style={[
          styles.endOfEpisodeButton,
          { backgroundColor: mode === 'endOfEpisode' ? theme.accent : theme.backgroundElement },
        ]}>
        <ThemedText
          type="smallBold"
          themeColor={mode === 'endOfEpisode' ? 'background' : 'text'}
          style={styles.centerText}>
          End of Episode
        </ThemedText>
      </Pressable>

      {mode !== 'off' && (
        <Pressable onPress={onCancel} style={styles.deleteButton}>
          <SymbolView tintColor={theme.danger} name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} />
          <ThemedText type="smallBold" themeColor="danger">
            Delete Sleep Timer
          </ThemedText>
        </Pressable>
      )}
    </ModalSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    gap: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  gridButton: {
    width: '31.5%',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  endOfEpisodeButton: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
});
