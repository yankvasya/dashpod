import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/** Simple shimmering placeholder — a pulsing-opacity block, sized however the caller styles it.
 * Used behind slow-loading images until they resolve, in place of a hard pop-in. */
export function ShimmerView({ style }: { style?: ViewStyle | ViewStyle[] }) {
  const theme = useTheme();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[{ backgroundColor: theme.backgroundElement }, style, animatedStyle]} />;
}
