import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import DownloadProgressBanner from '@/components/DownloadProgressBanner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PlayerSheet } from '@/components/player/PlayerSheet';
import { ThemeTransitionOverlay } from '@/components/ThemeTransitionOverlay';
import UpdateBanner from '@/components/UpdateBanner';
import { Colors } from '@/constants/theme';
import { migrateDbIfNeeded } from '@/db/database';
import '@/i18n';
import { AppUpdateProvider } from '@/hooks/useAppUpdate';
import { DownloadsProvider, useDownloads } from '@/hooks/useDownloads';
import { PlayerProvider } from '@/hooks/usePlayer';
import { QueueProvider, useQueue } from '@/hooks/useQueue';
import { SettingsProvider, useSettings } from '@/hooks/useSettings';
import { SubscriptionsProvider, useSubscriptions } from '@/hooks/useSubscriptions';
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
      <AppUpdateProvider>
        <SubscriptionsProvider>
          <DownloadsProvider>
            <QueueProvider>
              <PlayerProvider>
                <AppReadyGate />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                </Stack>
                <PlayerSheet />
                <DownloadProgressBanner />
              </PlayerProvider>
            </QueueProvider>
          </DownloadsProvider>
        </SubscriptionsProvider>
        <ErrorBoundary>
          <UpdateBanner />
        </ErrorBoundary>
      </AppUpdateProvider>
      <ThemeTransitionOverlay background={Colors[themeId].background} />
    </ThemeProvider>
  );
}

// Caps how long the splash can be held open prefetching artwork — a slow/offline network
// shouldn't be able to block launch indefinitely; prefetching is a best-effort head start on the
// image cache, not a hard requirement.
const IMAGE_PREFETCH_TIMEOUT_MS = 1500;

/** Holds the splash overlay up until every provider a first-launch tab could read from has
 * finished its initial SQLite load — not just fonts — and until the artwork those tabs will
 * immediately show has had a chance to prefetch into the image cache. Needs to live inside all of
 * them (rather than alongside RootLayoutContent's other top-level children) purely to read their
 * `loading` flags and data; see AnimatedSplashOverlay for why this matters.
 *
 * The data-readiness gate alone (settings/subscriptions/downloads/queue all loaded) fixed the
 * "screen renders empty, then pops in a moment later" jank, but not every following report of
 * first-launch jank — the rows themselves were ready, but each row's artwork was still a cache
 * miss loading over the network for the first time, which is a second, independent source of
 * pop-in unrelated to whether the underlying SQLite data was ready. Since every subscription/
 * download/queue artwork URL is already known in memory at this point, prefetching them here
 * means the very first paint of Home/My Podcasts/Downloads/Queue can hit a warm cache instead. */
function AppReadyGate() {
  const { loading: settingsLoading } = useSettings();
  const { loading: subscriptionsLoading, subscriptions } = useSubscriptions();
  const { loading: downloadsLoading, downloads } = useDownloads();
  const { loading: queueLoading, queue } = useQueue();
  const dataReady = !settingsLoading && !subscriptionsLoading && !downloadsLoading && !queueLoading;
  const [imagesReady, setImagesReady] = useState(false);

  useEffect(() => {
    if (!dataReady || imagesReady) return;
    const urls = Array.from(
      new Set(
        [...subscriptions, ...downloads, ...queue]
          .map((item) => item.artworkUrl)
          .filter((url): url is string => !!url)
      )
    );
    const prefetch = urls.length > 0 ? Image.prefetch(urls) : Promise.resolve(true);
    const timeout = new Promise((resolve) => setTimeout(resolve, IMAGE_PREFETCH_TIMEOUT_MS));
    Promise.race([prefetch, timeout]).finally(() => setImagesReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataReady]);

  return <AnimatedSplashOverlay ready={dataReady && imagesReady} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
