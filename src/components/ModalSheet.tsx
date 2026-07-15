import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const ANIMATION_DURATION = 220;
const SHEET_OFFSET = 400;

interface ModalSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  contentStyle?: ViewStyle | ViewStyle[];
}

/** Shared bottom-sheet modal for SpeedModal/SleepTimerModal/CalendarMonthGrid — a translucent
 * scrim fades in/out independently of the sheet's slide, both driven by this component instead
 * of RN's built-in `Modal animationType`, which animates the whole scrim+sheet tree as one
 * transform and can't express "sheet slides, scrim fades" as two different curves. Tapping
 * anywhere outside the sheet closes it; there's no separate "Done" button by design. */
export function ModalSheet({ visible, onClose, children, contentStyle }: ModalSheetProps) {
  const [rendered, setRendered] = useState(visible);
  const scrimOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSET)).current;

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 1, duration: ANIMATION_DURATION, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 0, duration: ANIMATION_DURATION, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scrimOpacity, { toValue: 0, duration: ANIMATION_DURATION, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, {
          toValue: SHEET_OFFSET,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => finished && setRendered(false));
    }
  }, [visible, scrimOpacity, sheetTranslateY]);

  if (!rendered) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.scrim, { opacity: scrimOpacity }]} />
      </Pressable>
      <Pressable style={[StyleSheet.absoluteFill, styles.sheetPositioner]} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <Animated.View style={{ transform: [{ translateY: sheetTranslateY }] }}>
            <ThemedView style={[styles.sheet, contentStyle]}>{children}</ThemedView>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetPositioner: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Spacing.five,
    borderTopRightRadius: Spacing.five,
    padding: Spacing.five,
  },
});
