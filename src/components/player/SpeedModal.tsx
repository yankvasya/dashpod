import Slider from '@react-native-community/slider';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PRESET_SPEEDS = [1, 1.5, 1.75, 2];

export function formatSpeed(rate: number): string {
  const fixed = rate.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${fixed}x`;
}

interface SpeedModalProps {
  visible: boolean;
  rate: number;
  onChange: (rate: number) => void;
  onClose: () => void;
}

export function SpeedModal({ visible, rate, onChange, onClose }: SpeedModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <ThemedView style={styles.sheet}>
            <ThemedText type="subtitle" style={styles.centerText}>
              {formatSpeed(rate)}
            </ThemedText>

            <View style={styles.presetsRow}>
              {PRESET_SPEEDS.map((preset) => {
                const selected = Math.abs(rate - preset) < 0.01;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => onChange(preset)}
                    style={[
                      styles.presetButton,
                      { backgroundColor: selected ? theme.accent : theme.backgroundElement },
                    ]}>
                    <ThemedText type="smallBold" themeColor={selected ? 'background' : 'text'}>
                      {formatSpeed(preset)}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <Slider
              value={rate}
              minimumValue={0.5}
              maximumValue={2.5}
              step={0.1}
              onValueChange={(value) => onChange(Math.round(value * 10) / 10)}
              minimumTrackTintColor={theme.accent}
              maximumTrackTintColor={theme.backgroundSelected}
              thumbTintColor={theme.accent}
            />
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
  },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    padding: Spacing.five,
    gap: Spacing.four,
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
});
