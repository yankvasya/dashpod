import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchReleaseHistory, type ReleaseNote } from '@/services/updateCheck';

/** "What's New" — shows recent GitHub release descriptions in place, reached from Settings'
 * About section. Rendered in place (not a routed push), same local-state + onBack pattern as the
 * other More/Settings sub-screens. Only releases with a real description show up here — see
 * fetchReleaseHistory for why that naturally excludes this project's earlier, undocumented
 * releases instead of needing any filtering here. */
export function ReleaseNotesView({ onBack }: { onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const [notes, setNotes] = useState<ReleaseNote[] | null>(null);

  useEffect(() => {
    fetchReleaseHistory().then(setNotes);
  }, []);

  return (
    <>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('common.back')}
        </ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>
        {t('settings.whatsNew')}
      </ThemedText>

      {notes === null ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => String(item.buildNumber)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('settings.whatsNewEmpty')}
            </ThemedText>
          }
          ItemSeparatorComponent={() => <ThemedView type="backgroundElement" style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.entry}>
              <View style={styles.entryHeader}>
                <ThemedText type="smallBold">
                  {t('settings.versionBuild', { version: item.version, stage: item.stage, build: item.buildNumber })}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {new Date(item.publishedAt).toLocaleDateString(i18n.language)}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {item.body}
              </ThemedText>
            </View>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  loading: {
    paddingTop: Spacing.five,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
  },
  entry: {
    gap: Spacing.one,
    paddingVertical: Spacing.three,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
