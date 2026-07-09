import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import MiniPlayer from '@/components/player/MiniPlayer';
import { BottomTabBarHeight, Spacing } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/database';
import { DownloadsProvider } from '@/hooks/useDownloads';
import { PlayerProvider } from '@/hooks/usePlayer';
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
    <SQLiteProvider databaseName="dashpod.db" onInit={migrateDbIfNeeded}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <SubscriptionsProvider>
          <DownloadsProvider>
            <PlayerProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="podcast/[feedUrl]"
                  options={{ headerShown: true, title: '', headerBackButtonDisplayMode: 'minimal' }}
                />
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
            </PlayerProvider>
          </DownloadsProvider>
        </SubscriptionsProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  miniPlayerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
