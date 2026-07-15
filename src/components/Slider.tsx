import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

const THUMB_SIZE = 16;
const TRACK_HEIGHT = 4;

interface SliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step?: number;
  onValueChange?: (value: number) => void;
  onSlidingStart?: () => void;
  onSlidingComplete?: (value: number) => void;
  minimumTrackTintColor: string;
  maximumTrackTintColor: string;
  thumbTintColor: string;
}

/** Hand-drawn slider so the seek bar and speed control render identically on iOS and Android —
 * `@react-native-community/slider` delegates to each platform's native slider widget (a UISlider
 * on iOS, a Material slider on Android), which look substantially different from each other and
 * can't be made to match via its styling props. */
export function Slider({
  value,
  minimumValue,
  maximumValue,
  step,
  onValueChange,
  onSlidingStart,
  onSlidingComplete,
  minimumTrackTintColor,
  maximumTrackTintColor,
  thumbTintColor,
}: SliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);

  function clampToRange(raw: number) {
    let next = Math.min(maximumValue, Math.max(minimumValue, raw));
    if (step) next = Math.round(next / step) * step;
    return next;
  }

  function valueFromLocationX(locationX: number) {
    const width = trackWidthRef.current;
    if (width <= 0 || maximumValue <= minimumValue) return value;
    const fraction = Math.min(1, Math.max(0, (locationX - THUMB_SIZE / 2) / width));
    return clampToRange(minimumValue + fraction * (maximumValue - minimumValue));
  }

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          onSlidingStart?.();
          onValueChange?.(valueFromLocationX(event.nativeEvent.locationX));
        },
        onPanResponderMove: (event) => {
          onValueChange?.(valueFromLocationX(event.nativeEvent.locationX));
        },
        onPanResponderRelease: (event) => {
          onSlidingComplete?.(valueFromLocationX(event.nativeEvent.locationX));
        },
        onPanResponderTerminate: (event) => {
          onSlidingComplete?.(valueFromLocationX(event.nativeEvent.locationX));
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }),
    [minimumValue, maximumValue, step]
  );

  function handleLayout(event: LayoutChangeEvent) {
    const width = Math.max(0, event.nativeEvent.layout.width - THUMB_SIZE);
    trackWidthRef.current = width;
    setTrackWidth(width);
  }

  const progress =
    maximumValue > minimumValue ? (clampToRange(value) - minimumValue) / (maximumValue - minimumValue) : 0;
  const thumbOffset = trackWidth * progress;

  return (
    <View style={styles.container} onLayout={handleLayout} {...panResponder.panHandlers}>
      <View style={[styles.track, { backgroundColor: maximumTrackTintColor }]} />
      <View
        style={[
          styles.track,
          styles.fillTrack,
          { backgroundColor: minimumTrackTintColor, width: thumbOffset + THUMB_SIZE / 2 },
        ]}
      />
      <View style={[styles.thumb, { backgroundColor: thumbTintColor, transform: [{ translateX: thumbOffset }] }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: THUMB_SIZE + 16,
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: THUMB_SIZE / 2,
    right: THUMB_SIZE / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
  },
  fillTrack: {
    left: 0,
    right: undefined,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
});
