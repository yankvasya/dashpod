import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import MiniPlayer from '@/components/player/MiniPlayer';
import { BottomTabInset } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/database';
import { configureAudioSession } from '@/services/audio';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    configureAudioSession();
  }, []);

  return (
    <SQLiteProvider databaseName="dashpod.db" onInit={migrateDbIfNeeded}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
        <AppTabs />
        <View style={[styles.miniPlayerContainer, { bottom: BottomTabInset }]} pointerEvents="box-none">
          <MiniPlayer />
        </View>
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
