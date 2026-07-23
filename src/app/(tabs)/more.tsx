import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DownloadsView } from '@/components/DownloadsView';
import { HistoryView } from '@/components/HistoryView';
import { QueueView } from '@/components/QueueView';
import { SettingsView } from '@/components/SettingsView';
import { StatsView } from '@/components/StatsView';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Section = 'downloads' | 'queue' | 'history' | 'stats' | 'settings' | null;

const FIXED_MORE_ITEMS = [
  { key: 'history', labelKey: 'history', icon: 'time-outline' },
  { key: 'stats', labelKey: 'stats', icon: 'pie-chart-outline' },
  { key: 'settings', labelKey: 'settings', icon: 'settings-outline' },
] as const satisfies { key: Section; labelKey: string; icon: IconName }[];

/** History/Stats/Settings always render in place here (not routed pushes) — the tab bar only has
 * room for 5 real tabs, and pushing these as root-level Stack screens from within the tab
 * navigator turned out unreliable (inconsistent open behavior across platforms), so this follows
 * the same proven local-state + Back pattern already used for PodcastDetailView instead.
 *
 * Downloads/Queue join this list too whenever the user has unpinned them from the main tab bar
 * (Settings > Customize Tabs) — same DownloadsView/QueueView components the pinned tabs use, just
 * with an onBack handler instead of none. */
export default function MoreScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { pinnedTabs } = useSettings();
  const [section, setSection] = useState<Section>(null);

  // useFocusEffect (not a plain useEffect) so this listener is only live while More is actually
  // focused — see usePodcastDetailNavigation.ts for why that matters on Android.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (section) {
          setSection(null);
          return true;
        }
        return false;
      });
      return () => subscription.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [section])
  );

  // Re-tapping the already-active More tab should reset to the menu, same as re-tapping
  // Home/My Podcasts closes an open podcast detail — see usePodcastDetailNavigation.ts. The tab
  // router's own "reset to root" only resets a real nested stack; section here is local state.
  useEffect(() => {
    // @ts-expect-error -- 'tabPress' is part of the tab navigator's event map but the generic
    // useNavigation() return type here isn't narrowed to it.
    return navigation.addListener('tabPress', () => {
      setSection((current) => (current ? null : current));
    });
  }, [navigation]);

  const menuItems: { key: Exclude<Section, null>; label: string; icon: IconName }[] = [
    ...(!pinnedTabs.includes('downloads')
      ? [{ key: 'downloads' as const, label: t('tabs.downloads'), icon: 'download-outline' as IconName }]
      : []),
    ...(!pinnedTabs.includes('queue')
      ? [{ key: 'queue' as const, label: t('tabs.queue'), icon: 'list-outline' as IconName }]
      : []),
    ...FIXED_MORE_ITEMS.map((item) => ({ key: item.key, label: t(`more.${item.labelKey}`), icon: item.icon })),
  ];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {section === 'downloads' && <DownloadsView onBack={() => setSection(null)} />}
        {section === 'queue' && <QueueView onBack={() => setSection(null)} />}
        {section === 'history' && <HistoryView onBack={() => setSection(null)} />}
        {section === 'stats' && <StatsView onBack={() => setSection(null)} />}
        {section === 'settings' && <SettingsView onBack={() => setSection(null)} />}
        {!section && (
          <>
            <ThemedText type="title" style={styles.title}>
              {t('more.title')}
            </ThemedText>

            <ThemedView type="backgroundElement" style={styles.section}>
              {menuItems.map((item, index) => (
                <Pressable
                  key={item.key}
                  onPress={() => setSection(item.key)}
                  style={[
                    styles.row,
                    index > 0 && [styles.rowBorder, { borderColor: theme.backgroundSelected }],
                  ]}>
                  <Ionicons name={item.icon} color={theme.text} size={20} />
                  <ThemedText style={styles.rowLabel}>{item.label}</ThemedText>
                  <Ionicons name="chevron-forward-outline" color={theme.textSecondary} size={16} />
                </Pressable>
              ))}
            </ThemedView>
          </>
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
  title: {
    fontSize: 32,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  section: {
    marginHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: {
    flex: 1,
  },
});
