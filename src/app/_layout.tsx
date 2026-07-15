import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import DownloadProgressBanner from '@/components/DownloadProgressBanner';
import MiniPlayer from '@/components/player/MiniPlayer';
import UpdateBanner from '@/components/UpdateBanner';
import { BottomTabBarHeight, Spacing } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/database';
import { AppUpdateProvider } from '@/hooks/useAppUpdate';
import { DownloadsProvider } from '@/hooks/useDownloads';
import { PlayerProvider } from '@/hooks/usePlayer';
import { QueueProvider } from '@/hooks/useQueue';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { SubscriptionsProvider } from '@/hooks/useSubscriptions';
import { configureAudioSession } from '@/services/audio';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    configureAudioSession();
  }, []);

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
  const insets = useSafeAreaInsets();
  // MiniPlayer is rendered outside the Stack (so it overlays every tab), which means nothing
  // stops it from also rendering on top of the "player" modal route. On iOS the native modal
  // presentation happens to visually cover it regardless; Android's JS-driven modal transition
  // doesn't, so the mini player stayed visible and tappable there — each tap pushed another
  // "player" screen onto the stack. Hide it explicitly whenever that route is active.
  const isPlayerRouteOpen = usePathname() === '/player';

  return (
    <ThemeProvider value={themeId === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppUpdateProvider>
        <SubscriptionsProvider>
          <DownloadsProvider>
            <QueueProvider>
              <PlayerProvider>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="player" options={{ presentation: 'modal', headerShown: false }} />
                </Stack>
                {!isPlayerRouteOpen && (
                  <View
                    style={[
                      styles.miniPlayerContainer,
                      { bottom: BottomTabBarHeight + insets.bottom + Spacing.one },
                    ]}
                    pointerEvents="box-none">
                    <MiniPlayer />
                  </View>
                )}
                <DownloadProgressBanner />
              </PlayerProvider>
            </QueueProvider>
          </DownloadsProvider>
        </SubscriptionsProvider>
        <UpdateBanner />
      </AppUpdateProvider>
    </ThemeProvider>
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
