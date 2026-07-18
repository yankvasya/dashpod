import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const DURATION = 300;

/** Renders a fading overlay in the previous theme's background color whenever it changes, so
 * switching themes reads as a soft crossfade instead of every screen snapping to the new colors
 * at once. Doesn't animate individual text/icon colors underneath — those still switch instantly
 * — but the overlay covers that instant switch while it fades away. */
export function ThemeTransitionOverlay({ background }: { background: string }) {
  const [overlayColor, setOverlayColor] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const previousBackground = useRef(background);

  useEffect(() => {
    if (previousBackground.current === background) return;
    setOverlayColor(previousBackground.current);
    previousBackground.current = background;
    opacity.value = 1;
    opacity.value = withTiming(0, { duration: DURATION });
  }, [background, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!overlayColor) return null;

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: overlayColor }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 1000,
  },
});
