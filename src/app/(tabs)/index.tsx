import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PodcastDetailView } from '@/components/PodcastDetailView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePodcastDetailNavigation } from '@/hooks/usePodcastDetailNavigation';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { searchPodcasts } from '@/services/itunesSearch';
import type { ITunesSearchResult } from '@/types/podcast';

const SEARCH_DEBOUNCE_MS = 600;

export default function HomeScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { subscriptions, subscribe, unsubscribe } = useSubscriptions();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ITunesSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Guards a stale in-flight search from overwriting a newer one's results, e.g. if a fast
  // network response for an earlier query lands after a later query's response.
  const requestIdRef = useRef(0);

  const [rssUrl, setRssUrl] = useState('');
  const [addingRss, setAddingRss] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);

  const [pendingFeedUrl, setPendingFeedUrl] = useState<string | null>(null);
  const { selectedFeedUrl, mountedFeedUrl, openPodcast, closePodcast } = usePodcastDetailNavigation();

  const subscribedFeedUrls = useMemo(
    () => new Set(subscriptions.map((podcast) => podcast.feedUrl)),
    [subscriptions]
  );

  // The dedicated results view: active as soon as there's a query, distinct from the idle
  // "add via RSS" state below it — cleared by the Cancel button rather than a route change,
  // since this screen has nothing else on it to navigate back to.
  const isSearchActive = query.trim().length > 0;

  async function runSearch(searchQuery: string) {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }
    const requestId = ++requestIdRef.current;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchPodcasts(trimmed);
      if (requestIdRef.current !== requestId) return;
      setResults(found);
      setHasSearched(true);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setSearchError(t('search.searchFailed'));
    } finally {
      if (requestIdRef.current === requestId) setSearching(false);
    }
  }

  // Live predictive search: fires automatically SEARCH_DEBOUNCE_MS after typing stops, so most
  // searches never need the (still-available) explicit submit. Clearing the query (e.g.
  // backspacing it out) drops stale results immediately instead of leaving them up for the
  // rest of the debounce window, which would otherwise flash alongside the RSS section as soon
  // as isSearchActive flips false.
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }
    const timeout = setTimeout(() => runSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function cancelSearch() {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setSearchError(null);
  }

  async function toggleSubscription(feedUrl: string) {
    const existing = subscriptions.find((podcast) => podcast.feedUrl === feedUrl);
    setPendingFeedUrl(feedUrl);
    setSearchError(null);
    try {
      if (existing) {
        await unsubscribe(existing.id);
      } else {
        await subscribe(feedUrl);
      }
    } catch {
      setSearchError(t('search.couldNotUpdate'));
    } finally {
      setPendingFeedUrl(null);
    }
  }

  async function addByRssUrl() {
    if (!rssUrl.trim()) return;
    setAddingRss(true);
    setRssError(null);
    try {
      const feedUrl = rssUrl.trim();
      await subscribe(feedUrl);
      setRssUrl('');
      openPodcast(feedUrl);
    } catch {
      setRssError(t('search.rssError'));
    } finally {
      setAddingRss(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.flexFill, selectedFeedUrl && styles.hidden]}>
          <FlatList
            data={results}
            keyExtractor={(item) => String(item.collectionId)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              <ThemedView style={styles.headerSection}>
                <ThemedText type="title" style={styles.title}>
                  {t('search.title')}
                </ThemedText>

                <ThemedView type="backgroundElement" style={styles.searchRow}>
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    onSubmitEditing={() => runSearch(query)}
                    placeholder={t('search.placeholder')}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text }]}
                    returnKeyType="search"
                  />
                  {searching && <ActivityIndicator />}
                  {isSearchActive && (
                    <Pressable onPress={cancelSearch} hitSlop={8}>
                      <ThemedText type="linkPrimary" themeColor="accent" numberOfLines={1}>
                        {t('common.cancel')}
                      </ThemedText>
                    </Pressable>
                  )}
                </ThemedView>

                {searchError && <ThemedText themeColor="textSecondary">{searchError}</ThemedText>}
              </ThemedView>
            }
            ListEmptyComponent={
              isSearchActive && hasSearched && !searching ? (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {t('search.noResults')}
                </ThemedText>
              ) : null
            }
            renderItem={({ item }) => {
              const added = subscribedFeedUrls.has(item.feedUrl);
              return (
                <ThemedView style={styles.resultRow}>
                  <Pressable
                    onPress={() => openPodcast(item.feedUrl)}
                    style={({ pressed }) => [styles.resultMain, pressed && styles.pressed]}>
                    <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
                    <ThemedView style={styles.resultText}>
                      <ThemedText numberOfLines={1}>{item.trackName}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {item.artistName}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSubscription(item.feedUrl)}
                    disabled={pendingFeedUrl === item.feedUrl}
                    hitSlop={8}
                    style={[styles.iconButton, { backgroundColor: added ? theme.accent : 'transparent' }]}>
                    {pendingFeedUrl === item.feedUrl ? (
                      <ActivityIndicator size="small" color={theme.textSecondary} />
                    ) : (
                      <Ionicons
                        name={added ? 'checkmark-circle' : 'add-circle-outline'}
                        color={added ? theme.background : theme.textSecondary}
                        size={22}
                      />
                    )}
                  </Pressable>
                </ThemedView>
              );
            }}
            ListFooterComponent={
              !isSearchActive ? (
                <ThemedView type="backgroundElement" style={styles.rssSection}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('search.rssLabel')}
                  </ThemedText>
                  <ThemedView style={styles.searchRow}>
                    <TextInput
                      value={rssUrl}
                      onChangeText={setRssUrl}
                      onSubmitEditing={addByRssUrl}
                      placeholder={t('search.rssPlaceholder')}
                      placeholderTextColor={theme.textSecondary}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      style={[styles.input, { color: theme.text }]}
                    />
                    <Pressable onPress={addByRssUrl} hitSlop={8}>
                      {addingRss ? (
                        <ActivityIndicator />
                      ) : (
                        <ThemedText type="linkPrimary" themeColor="accent" numberOfLines={1}>
                          {t('search.rssAdd')}
                        </ThemedText>
                      )}
                    </Pressable>
                  </ThemedView>
                  {rssError && <ThemedText themeColor="textSecondary">{rssError}</ThemedText>}
                </ThemedView>
              ) : null
            }
          />
        </View>

        {mountedFeedUrl && (
          <View style={[styles.flexFill, styles.absoluteFill, !selectedFeedUrl && styles.hidden]}>
            <PodcastDetailView feedUrl={mountedFeedUrl} onBack={closePodcast} />
          </View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flexFill: {
    flex: 1,
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  hidden: {
    display: 'none',
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  headerSection: {
    gap: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 16,
    // Android's TextInput carries built-in EditText padding that iOS's equivalent doesn't have,
    // making the same layout look wider/taller there. Zero it so both platforms match.
    padding: 0,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  resultMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
  },
  resultText: {
    flex: 1,
    gap: Spacing.half,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  rssSection: {
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
});
