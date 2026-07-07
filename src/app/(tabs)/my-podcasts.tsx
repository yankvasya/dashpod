import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import type { Podcast } from '@/types/podcast';

export default function MyPodcastsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { subscriptions, unsubscribe } = useSubscriptions();

  function openPodcastDetail(podcast: Podcast) {
    router.push({ pathname: '/podcast/[feedUrl]', params: { feedUrl: podcast.feedUrl } });
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          My Podcasts
        </ThemedText>

        <FlatList
          data={subscriptions}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              No subscriptions yet — search for a podcast to get started.
            </ThemedText>
          }
          renderItem={({ item }) => (
            <ThemedView style={styles.row}>
              <Pressable
                onPress={() => openPodcastDetail(item)}
                style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}>
                <Image source={{ uri: item.artworkUrl }} style={styles.artwork} />
                <ThemedView style={styles.rowText}>
                  <ThemedText numberOfLines={1}>{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.author}
                  </ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable onPress={() => unsubscribe(item.id)} hitSlop={8} style={styles.unsubscribeButton}>
                <SymbolView
                  tintColor={theme.textSecondary}
                  name={{ ios: 'trash', android: 'delete', web: 'delete' }}
                  size={18}
                />
              </Pressable>
            </ThemedView>
          )}
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
  title: {
    fontSize: 32,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  artwork: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  unsubscribeButton: {
    padding: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
