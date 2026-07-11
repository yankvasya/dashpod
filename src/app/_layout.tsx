import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
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

  useEffect(() => {
    configureAudioSession();
  }, []);

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
                    <Stack.Screen name="player" options={{ presentation: 'modal', headerShown: false }} />
                  </Stack>
                  <View
                    style={[
                      styles.miniPlayerContainer,
                      { bottom: BottomTabBarHeight + insets.bottom + Spacing.one },
                    ]}
                    pointerEvents="box-none">
                    <MiniPlayer />
                  </View>
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
