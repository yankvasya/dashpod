import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import DownloadProgressBanner from '@/components/DownloadProgressBanner';
import MiniPlayer from '@/components/player/MiniPlayer';
import { BottomTabBarHeight, Spacing } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/database';
import { DownloadsProvider } from '@/hooks/useDownloads';
import { PlayerProvider } from '@/hooks/usePlayer';
import { QueueProvider } from '@/hooks/useQueue';
import { SubscriptionsProvider } from '@/hooks/useSubscriptions';
import { configureAudioSession } from '@/services/audio';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  // MiniPlayer is rendered outside the Stack (so it overlays every tab), which means nothing
  // stops it from also rendering on top of the "player" modal route. On iOS the native modal
  // presentation happens to visually cover it regardless; Android's JS-driven modal transition
  // doesn't, so the mini player stayed visible and tappable there — each tap pushed another
  // "player" screen onto the stack. Hide it explicitly whenever that route is active.
  const isPlayerRouteOpen = usePathname() === '/player';
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
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
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
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
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
