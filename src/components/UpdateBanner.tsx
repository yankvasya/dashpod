import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useTheme } from '@/hooks/use-theme';
import { downloadAndInstallUpdate } from '@/services/appUpdate';

const DISMISS_DISTANCE = 80;

export default function UpdateBanner() {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { updateAvailable, dismiss } = useAppUpdate();
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const translateX = useSharedValue(0);

  if (!updateAvailable) return null;

  async function handleUpdate() {
    if (!updateAvailable) return;
    if (Platform.OS === 'android' && updateAvailable.apkDownloadUrl) {
      setInstalling(true);
      try {
        await downloadAndInstallUpdate(updateAvailable.apkDownloadUrl, (bytesWritten, totalBytes) => {
          setProgress(totalBytes > 0 ? bytesWritten / totalBytes : 0);
        });
      } catch {
        // Most likely "install unknown apps" isn't granted yet, or the intent otherwise
        // couldn't be launched — fall back to letting the user grab it manually.
        Linking.openURL(updateAvailable.releaseUrl);
      } finally {
        setInstalling(false);
        setProgress(0);
      }
    } else {
      Linking.openURL(updateAvailable.releaseUrl);
    }
  }

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > DISMISS_DISTANCE) {
        translateX.value = withTiming(event.translationX > 0 ? 500 : -500, { duration: 200 }, () => {
          runOnJS(dismiss)();
        });
      } else {
        translateX.value = withTiming(0);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={[styles.container, { top: insets.top }]}>
      <GestureDetector gesture={pan}>
        <Animated.View style={animatedStyle}>
          <Pressable onPress={handleUpdate} disabled={installing}>
            <ThemedView type="backgroundElement" style={styles.banner}>
              <View style={styles.textContainer}>
                <ThemedText type="smallBold">
                  {installing
                    ? t('updateBanner.downloading')
                    : t('updateBanner.available', { version: updateAvailable.version, stage: updateAvailable.stage })}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {installing ? `${Math.round(progress * 100)}%` : t('updateBanner.tapToInstall')}
                </ThemedText>
              </View>
              <Pressable onPress={dismiss} hitSlop={8} style={styles.dismissButton}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  ✕
                </ThemedText>
              </Pressable>
            </ThemedView>
            {installing && (
              <View style={[styles.track, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[styles.fill, { backgroundColor: theme.accent, width: `${Math.max(4, progress * 100)}%` }]}
                />
              </View>
            )}
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  textContainer: {
    flex: 1,
    gap: Spacing.half,
  },
  dismissButton: {
    padding: Spacing.one,
  },
  track: {
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
    marginTop: Spacing.half,
  },
  fill: {
    height: 2,
  },
});
