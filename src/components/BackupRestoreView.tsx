import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDownloads } from '@/hooks/useDownloads';
import { useQueue } from '@/hooks/useQueue';
import { useSettings } from '@/hooks/useSettings';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { useTheme } from '@/hooks/use-theme';
import {
  applyBackup,
  exportBackupFile,
  exportOpmlFile,
  gatherBackupData,
  pickBackupFile,
  pickOpmlFile,
} from '@/services/backup';

type ExportCategory = 'subscriptions' | 'downloads' | 'queue' | 'history' | 'settings';

const appVersion = Constants.expoConfig?.version ?? 'unknown';

/** Settings sub-screen for local backup/restore — no accounts or server involved. Export produces
 * a file the user saves/shares themselves (their own cloud, email, etc.); import reads that file
 * back. See services/backup.ts for exactly what each category does and doesn't cover (downloaded
 * audio files themselves are never included, only which episodes were downloaded). */
export function BackupRestoreView({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const { subscriptions, subscribe } = useSubscriptions();
  const { downloads } = useDownloads();
  const { queue } = useQueue();
  const { themeId, languageId, allowMobileDataDownloads, autoCheckForUpdates } = useSettings();
  const [selected, setSelected] = useState<Set<ExportCategory>>(
    new Set<ExportCategory>(['subscriptions', 'downloads', 'queue', 'history', 'settings'])
  );
  const [busy, setBusy] = useState<'export' | 'import' | 'exportOpml' | 'importOpml' | null>(null);

  const CATEGORIES: { id: ExportCategory; label: string }[] = [
    { id: 'subscriptions', label: t('backup.categorySubscriptions') },
    { id: 'downloads', label: t('backup.categoryDownloads') },
    { id: 'queue', label: t('backup.categoryQueue') },
    { id: 'history', label: t('backup.categoryHistory') },
    { id: 'settings', label: t('backup.categorySettings') },
  ];

  function toggleCategory(id: ExportCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function feedUrlByPodcastId(): Map<number, string> {
    return new Map(subscriptions.map((podcast) => [podcast.id, podcast.feedUrl]));
  }

  async function handleExportBackup() {
    setBusy('export');
    try {
      const feedUrlById = feedUrlByPodcastId();
      const data = await gatherBackupData(
        db,
        {
          subscriptions: selected.has('subscriptions'),
          downloads: selected.has('downloads'),
          queue: selected.has('queue'),
          history: selected.has('history'),
          settings: selected.has('settings'),
        },
        {
          subscriptions: subscriptions.map((podcast) => ({ feedUrl: podcast.feedUrl })),
          downloads: downloads
            .map((item) => ({
              feedUrl: feedUrlById.get(item.podcastId) ?? '',
              guid: item.guid,
              episodeTitle: item.episodeTitle,
              podcastTitle: item.podcastTitle,
            }))
            .filter((item) => item.feedUrl),
          queue: queue
            .map((item) => ({ feedUrl: feedUrlById.get(item.podcastId) ?? '', guid: item.guid }))
            .filter((item) => item.feedUrl),
          settings: { themeId, languageId, allowMobileDataDownloads, autoCheckForUpdates },
        },
        appVersion
      );
      await exportBackupFile(data);
    } catch {
      Alert.alert(t('backup.exportFailedTitle'), t('backup.exportFailedMessage'));
    } finally {
      setBusy(null);
    }
  }

  async function handleImportBackup() {
    setBusy('import');
    try {
      const data = await pickBackupFile();
      if (!data) {
        setBusy(null);
        return;
      }
      const result = await applyBackup(db, data, subscribe);
      Alert.alert(
        t('backup.importDoneTitle'),
        t('backup.importDoneMessage', {
          subscribed: result.subscribedFeeds,
          failed: result.failedFeedUrls.length,
          queue: result.queueItemsRestored,
        })
      );
    } catch {
      Alert.alert(t('backup.importFailedTitle'), t('backup.importFailedMessage'));
    } finally {
      setBusy(null);
    }
  }

  async function handleExportOpml() {
    setBusy('exportOpml');
    try {
      await exportOpmlFile(subscriptions.map((podcast) => ({ title: podcast.title, feedUrl: podcast.feedUrl })));
    } catch {
      Alert.alert(t('backup.exportFailedTitle'), t('backup.exportFailedMessage'));
    } finally {
      setBusy(null);
    }
  }

  async function handleImportOpml() {
    setBusy('importOpml');
    try {
      const feeds = await pickOpmlFile();
      if (!feeds) {
        setBusy(null);
        return;
      }
      const existingFeedUrls = new Set(subscriptions.map((podcast) => podcast.feedUrl));
      let subscribedCount = 0;
      let failedCount = 0;
      for (const feed of feeds) {
        if (existingFeedUrls.has(feed.feedUrl)) continue;
        try {
          await subscribe(feed.feedUrl);
          subscribedCount += 1;
        } catch {
          failedCount += 1;
        }
      }
      Alert.alert(t('backup.importDoneTitle'), t('backup.importOpmlDoneMessage', { subscribed: subscribedCount, failed: failedCount }));
    } catch {
      Alert.alert(t('backup.importFailedTitle'), t('backup.importFailedMessage'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('common.back')}
        </ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>
        {t('backup.title')}
      </ThemedText>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
          {t('backup.intro')}
        </ThemedText>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          {t('backup.opmlSection')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.section}>
          <Pressable
            onPress={handleExportOpml}
            disabled={busy != null || subscriptions.length === 0}
            style={[styles.row, { opacity: subscriptions.length === 0 ? 0.4 : 1 }]}>
            <ThemedText themeColor="accent">{t('backup.exportOpml')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={handleImportOpml}
            disabled={busy != null}
            style={[styles.row, styles.rowBorder, { borderColor: theme.backgroundSelected }]}>
            <ThemedText themeColor="accent">{t('backup.importOpml')}</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          {t('backup.backupSection')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.section}>
          {CATEGORIES.map((category, index) => (
            <Pressable
              key={category.id}
              onPress={() => toggleCategory(category.id)}
              style={[styles.row, index > 0 && [styles.rowBorder, { borderColor: theme.backgroundSelected }]]}>
              <ThemedText style={styles.categoryLabel}>{category.label}</ThemedText>
              <Ionicons
                name={selected.has(category.id) ? 'checkbox' : 'square-outline'}
                color={selected.has(category.id) ? theme.accent : theme.textSecondary}
                size={22}
              />
            </Pressable>
          ))}
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary" style={styles.downloadsNote}>
          {t('backup.downloadsNote')}
        </ThemedText>

        <View style={styles.actions}>
          <Pressable
            onPress={handleExportBackup}
            disabled={busy != null || selected.size === 0}
            style={[styles.primaryButton, { backgroundColor: theme.accent, opacity: selected.size === 0 ? 0.5 : 1 }]}>
            <ThemedText type="smallBold" themeColor="background">
              {busy === 'export' ? t('backup.exporting') : t('backup.exportBackup')}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleImportBackup}
            disabled={busy != null}
            style={[styles.secondaryButton, { borderColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold">{busy === 'import' ? t('backup.importing') : t('backup.importBackup')}</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  intro: {
    marginBottom: Spacing.one,
  },
  sectionLabel: {
    paddingHorizontal: Spacing.two,
  },
  section: {
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  categoryLabel: {
    flex: 1,
    marginRight: Spacing.three,
  },
  downloadsNote: {
    marginTop: -Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
});
