import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PodcastDetailView } from '@/components/PodcastDetailView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePodcastDetailNavigation } from '@/hooks/usePodcastDetailNavigation';
import { useSubscriptions } from '@/hooks/useSubscriptions';

export default function MyPodcastsScreen() {
  const theme = useTheme();
  const { subscriptions, unsubscribe } = useSubscriptions();
  const { selectedFeedUrl, mountedFeedUrl, openPodcast, closePodcast } = usePodcastDetailNavigation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={[styles.flexFill, selectedFeedUrl && styles.hidden]}>
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
                  onPress={() => openPodcast(item.feedUrl)}
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
