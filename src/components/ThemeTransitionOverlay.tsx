import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const DURATION = 300;

/** Renders a fading overlay in the previous theme's background color whenever it changes, so
 * switching themes reads as a soft crossfade instead of every screen snapping to the new colors
 * at once. Doesn't animate individual text/icon colors underneath — those still switch instantly
 * — but the overlay covers that instant switch while it fades away.
 *
 * Always mounted (no conditional `return null`) so there's no gap between "decide to show the
 * overlay" and "the overlay's View actually exists to be seen" — it used to set `overlayColor`
 * via state and start the opacity animation in the same effect, but the state update (and the
 * View that depends on it) only lands on React's next commit, while the Reanimated opacity
 * animation starts ticking immediately. On a slow frame the fade could be partway done — or
 * finished — before the overlay was ever painted, which read as the screen flickering/vanishing
 * instead of a smooth crossfade. */
export function ThemeTransitionOverlay({ background }: { background: string }) {
  const [overlayColor, setOverlayColor] = useState(background);
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
