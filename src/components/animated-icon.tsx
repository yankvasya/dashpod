import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const DURATION = 600;

/** `ready` should stay false until every screen the user could land on first has its data
 * already loaded (subscriptions, downloads, queue, settings) — see AppReadyGate in _layout.tsx.
 * Without this, the splash used to hide as soon as fonts were ready, well before those async
 * SQLite queries resolved, so whichever tab was visible would render empty and then visibly pop
 * in a moment later. Holding the splash a bit longer means that pop-in happens underneath it
 * instead of in front of the user. */
export function AnimatedSplashOverlay({ ready }: { ready: boolean }) {
  const [animate, setAnimate] = useState(false);
  const [visible, setVisible] = useState(true);
  const [laidOut, setLaidOut] = useState(false);

  useEffect(() => {
    if (!ready || !laidOut || animate) return;
    SplashScreen.hideAsync().finally(() => setAnimate(true));
  }, [ready, laidOut, animate]);

  if (!visible) return null;

  const splashKeyframe = new Keyframe({
    0: {
      transform: [{ scale: 1 }],
      opacity: 1,
    },
    20: {
      opacity: 1,
    },
    70: {
      opacity: 0,
      easing: Easing.elastic(0.7),
    },
    100: {
      opacity: 0,
      transform: [{ scale: 1 }],
      easing: Easing.elastic(0.7),
    },
  });

  const image = <Image style={styles.image} source={require('@/assets/images/splash-icon.png')} />;

  return animate ? (
    <Animated.View
      entering={splashKeyframe.duration(DURATION).withCallback((finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setVisible, false);
        }
      })}
      style={styles.splashOverlay}>
      {image}
    </Animated.View>
  ) : (
    <View onLayout={() => setLaidOut(true)} style={styles.splashOverlay}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: 76,
    height: 76,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#6C63FF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
});
