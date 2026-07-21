import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const HOLD_DURATION = 90;
const FADE_DURATION = 350;

/** Renders a fading overlay in the previous theme's background color whenever it changes, so
 * switching themes reads as a soft crossfade instead of every screen snapping to the new colors
 * at once. Doesn't animate individual text/icon colors underneath — those still switch instantly
 * — but the overlay covers that instant switch while it fades away.
 *
 * Held at full opacity for HOLD_DURATION before fading out, rather than starting the fade the
 * instant the theme changes: every themed component re-renders with the new colors immediately
 * (synchronously, on the same state update), but that new-colored content still has to actually
 * paint underneath the overlay — during the fade's early, still-mostly-opaque frames, the
 * newly-colored text was visible blended through the old-colored overlay, which (depending on the
 * two themes' contrast) could read as the text itself flickering or briefly disappearing instead
 * of a clean color crossfade. Holding fully opaque first means the swap happens completely hidden,
 * and the fade that follows only ever reveals the already-settled new screen, not a color blend.
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
    opacity.value = withDelay(
      HOLD_DURATION,
      withTiming(0, { duration: FADE_DURATION, easing: Easing.out(Easing.cubic) })
    );
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
