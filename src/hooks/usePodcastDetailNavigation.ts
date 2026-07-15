import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

/** Manages open/close state for the in-place `PodcastDetailView` pattern (rendered inline within
 * a tab screen rather than pushed as a route, so the tab bar stays visible underneath — see
 * PodcastDetailView.tsx). Also intercepts Android's hardware back button: since opening a podcast
 * doesn't push a route, there's no navigation history for the back button to pop, so without this
 * it closes the whole app instead of returning to the list. Same idea for re-tapping the
 * already-active tab: the tab router's own "reset to root" behavior only resets an actual nested
 * stack, and this podcast detail view isn't one — it's local state — so without this listener
 * re-tapping Home/My Podcasts while a podcast is open did nothing. */
export function usePodcastDetailNavigation() {
  const navigation = useNavigation();
  const [selectedFeedUrl, setSelectedFeedUrl] = useState<string | null>(null);
  // Stays set once a podcast has been opened so going back and re-opening the same one just
  // toggles display instead of unmounting/remounting PodcastDetailView (which was re-fetching
  // and re-flashing images every time — the "v-if vs v-show" difference).
  const [mountedFeedUrl, setMountedFeedUrl] = useState<string | null>(null);

  function openPodcast(feedUrl: string) {
    setMountedFeedUrl(feedUrl);
    setSelectedFeedUrl(feedUrl);
  }

  function closePodcast() {
    setSelectedFeedUrl(null);
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedFeedUrl) {
        closePodcast();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [selectedFeedUrl]);

  useEffect(() => {
    // @ts-expect-error -- 'tabPress' is part of the tab navigator's event map but the generic
    // useNavigation() return type here isn't narrowed to it.
    return navigation.addListener('tabPress', () => {
      setSelectedFeedUrl((current) => (current ? null : current));
    });
  }, [navigation]);

  return { selectedFeedUrl, mountedFeedUrl, openPodcast, closePodcast };
}
