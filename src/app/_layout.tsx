import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import DownloadProgressBanner from '@/components/DownloadProgressBanner';
import MiniPlayer from '@/components/player/MiniPlayer';
import { ThemeTransitionOverlay } from '@/components/ThemeTransitionOverlay';
import UpdateBanner from '@/components/UpdateBanner';
import { BottomTabBarHeight, Colors, Spacing } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/database';
import '@/i18n';
import { AppUpdateProvider } from '@/hooks/useAppUpdate';
import { DownloadsProvider } from '@/hooks/useDownloads';
import { PlayerProvider, usePlayer } from '@/hooks/usePlayer';
import { QueueProvider } from '@/hooks/useQueue';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { SubscriptionsProvider } from '@/hooks/useSubscriptions';
import { configureAudioSession } from '@/services/audio';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Bundled instead of relying on each platform's system font (San Francisco vs Roboto), so text
  // renders identically everywhere — see FontFamily in constants/theme.ts. Keep the native splash
  // screen up (already held by preventAutoHideAsync above) until these are ready, so there's no
  // flash of the system font before the custom one swaps in.
  const [fontsLoaded] = useFonts({ Inter_500Medium, Inter_600SemiBold, Inter_700Bold });

  useEffect(() => {
    configureAudioSession();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SQLiteProvider databaseName="dashpod.db" onInit={migrateDbIfNeeded}>
        <SettingsProvider>
          <RootLayoutContent />
        </SettingsProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

/** Split out from RootLayout so it can read the user's chosen theme (Settings screen) via
 * useSettings — that hook needs SettingsProvider above it, which itself needs SQLiteProvider. */
function RootLayoutContent() {
  const { themeId } = useSettings();

  return (
    <ThemeProvider value={Colors[themeId].isDark ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppUpdateProvider>
        <SubscriptionsProvider>
          <DownloadsProvider>
            <QueueProvider>
              <PlayerProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen
                    name="player"
                    options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }}
                  />
                </Stack>
                <MiniPlayerHost />
                <DownloadProgressBanner />
              </PlayerProvider>
            </QueueProvider>
          </DownloadsProvider>
        </SubscriptionsProvider>
        <UpdateBanner />
      </AppUpdateProvider>
      <ThemeTransitionOverlay background={Colors[themeId].background} />
    </ThemeProvider>
  );
}

/** MiniPlayer is rendered outside the Stack (so it overlays every tab), which means nothing
 * stops it from also rendering on top of the "player" modal route. On iOS the native modal
 * presentation happens to visually cover it regardless; Android's JS-driven modal transition
 * doesn't, so the mini player stayed visible and tappable there. A pathname-based check
 * (`usePathname() === '/player'`) didn't reliably catch this, so this reads whether the player
 * screen is actually mounted directly off PlayerProvider instead — the real ground truth, set by
 * player.tsx's own mount/unmount effect. Needs to live inside PlayerProvider to read it, hence
 * its own component rather than being computed in RootLayout above. */
function MiniPlayerHost() {
  const insets = useSafeAreaInsets();
  const { isPlayerScreenOpen } = usePlayer();

  if (isPlayerScreenOpen) return null;

  return (
    <View
      style={[styles.miniPlayerContainer, { bottom: BottomTabBarHeight + insets.bottom + Spacing.one }]}
      pointerEvents="box-none">
      <MiniPlayer />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  miniPlayerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
