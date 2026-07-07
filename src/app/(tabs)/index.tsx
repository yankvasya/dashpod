import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { searchPodcasts } from '@/services/itunesSearch';
import type { ITunesSearchResult } from '@/types/podcast';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { subscriptions, subscribe, unsubscribe } = useSubscriptions();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ITunesSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [rssUrl, setRssUrl] = useState('');
  const [addingRss, setAddingRss] = useState(false);
  const [rssError, setRssError] = useState<string | null>(null);

  const [pendingFeedUrl, setPendingFeedUrl] = useState<string | null>(null);

  const subscribedFeedUrls = useMemo(
    () => new Set(subscriptions.map((podcast) => podcast.feedUrl)),
    [subscriptions]
  );

  function openPodcastDetail(feedUrl: string) {
    router.push({ pathname: '/podcast/[feedUrl]', params: { feedUrl } });
  }

  async function runSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchPodcasts(query));
      setHasSearched(true);
    } catch {
      setSearchError('Search failed. Try again.');
    } finally {
      setSearching(false);
    }
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
      setSearchError('Could not update that podcast.');
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
      openPodcastDetail(feedUrl);
    } catch {
      setRssError('Could not load that feed. Check the URL.');
    } finally {
      setAddingRss(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.collectionId)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <ThemedView style={styles.headerSection}>
              <ThemedText type="title" style={styles.title}>
                Search
              </ThemedText>

              <ThemedView type="backgroundElement" style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={runSearch}
                  placeholder="Search podcasts"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text }]}
                  returnKeyType="search"
                />
                <Pressable onPress={runSearch} hitSlop={8}>
                  {searching ? (
                    <ActivityIndicator />
                  ) : (
                    <ThemedText type="linkPrimary" themeColor="accent">
                      Search
                    </ThemedText>
                  )}
                </Pressable>
              </ThemedView>

              {searchError && <ThemedText themeColor="textSecondary">{searchError}</ThemedText>}
            </ThemedView>
          }
          ListEmptyComponent={
            hasSearched && !searching ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No podcasts found.
              </ThemedText>
            ) : null
          }
          renderItem={({ item }) => (
            <ThemedView style={styles.resultRow}>
              <Pressable
                onPress={() => openPodcastDetail(item.feedUrl)}
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
                style={styles.addButton}>
                {pendingFeedUrl === item.feedUrl ? (
                  <ActivityIndicator />
                ) : (
                  <ThemedText type="smallBold" themeColor="accent">
                    {subscribedFeedUrls.has(item.feedUrl) ? 'Added' : 'Add'}
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          )}
          ListFooterComponent={
            <ThemedView type="backgroundElement" style={styles.rssSection}>
              <ThemedText type="small" themeColor="textSecondary">
                Or paste an RSS feed URL
              </ThemedText>
              <ThemedView style={styles.searchRow}>
                <TextInput
                  value={rssUrl}
                  onChangeText={setRssUrl}
                  onSubmitEditing={addByRssUrl}
                  placeholder="https://example.com/feed.xml"
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
                    <ThemedText type="linkPrimary" themeColor="accent">
                      Add
                    </ThemedText>
                  )}
                </Pressable>
              </ThemedView>
              {rssError && <ThemedText themeColor="textSecondary">{rssError}</ThemedText>}
            </ThemedView>
          }
        />
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
    fontSize: 16,
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
  addButton: {
    padding: Spacing.two,
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
    marginTop: Spacing.four,
    gap: Spacing.two,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
});
