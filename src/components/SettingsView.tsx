import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppUpdate } from '@/hooks/useAppUpdate';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type AppLanguageId, type AppThemeId } from '@/hooks/useSettings';
import { getCurrentBuildNumber } from '@/services/updateCheck';

type CheckResult = 'idle' | 'upToDate' | { version: string; stage: string };

const appVersion = Constants.expoConfig?.version ?? 'unknown';
const releaseStage = (Constants.expoConfig?.extra?.releaseStage as string | undefined) ?? 'dev';

/** Rendered in place within the More tab (not a routed push) — see more.tsx, which swaps this in
 * via local state, same pattern as HistoryView/StatsView/PodcastDetailView. */
export function SettingsView({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const {
    themeId,
    setThemeId,
    languageId,
    setLanguageId,
    allowMobileDataDownloads,
    setAllowMobileDataDownloads,
    autoCheckForUpdates,
    setAutoCheckForUpdates,
  } = useSettings();
  const { checkNow, checking } = useAppUpdate();
  const [checkResult, setCheckResult] = useState<CheckResult>('idle');
  const buildNumber = getCurrentBuildNumber();

  const lightThemeOptions: { id: AppThemeId; label: string }[] = [
    { id: 'light', label: t('settings.themeLight') },
    { id: 'cream', label: t('settings.themeCream') },
    { id: 'slate', label: t('settings.themeSlate') },
  ];
  const darkThemeOptions: { id: AppThemeId; label: string }[] = [
    { id: 'dark', label: t('settings.themeDark') },
    { id: 'midnightBlue', label: t('settings.themeMidnightBlue') },
    { id: 'forest', label: t('settings.themeForest') },
  ];
  const languageOptions: { id: AppLanguageId; label: string }[] = [
    { id: 'en', label: t('settings.languageEnglish') },
    { id: 'ru', label: t('settings.languageRussian') },
  ];

  async function handleCheckNow() {
    const result = await checkNow();
    setCheckResult(result ? { version: result.version, stage: result.stage } : 'upToDate');
  }

  return (
    <>
      <Pressable onPress={onBack} hitSlop={8} style={styles.backButton}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('common.back')}
        </ThemedText>
      </Pressable>

      <ThemedText type="title" style={styles.title}>
        {t('settings.title')}
      </ThemedText>

      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          {t('settings.appearance')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.section}>
          {lightThemeOptions.map((option, index) => (
            <Pressable
              key={option.id}
              onPress={() => setThemeId(option.id)}
              style={[styles.row, index > 0 && [styles.rowBorder, { borderColor: theme.backgroundSelected }]]}>
              <ThemedText>{option.label}</ThemedText>
              {themeId === option.id && <Ionicons name="checkmark" color={theme.accent} size={18} />}
            </Pressable>
          ))}
        </ThemedView>
        <ThemedView type="backgroundElement" style={styles.section}>
          {darkThemeOptions.map((option, index) => (
            <Pressable
              key={option.id}
              onPress={() => setThemeId(option.id)}
              style={[styles.row, index > 0 && [styles.rowBorder, { borderColor: theme.backgroundSelected }]]}>
              <ThemedText>{option.label}</ThemedText>
              {themeId === option.id && <Ionicons name="checkmark" color={theme.accent} size={18} />}
            </Pressable>
          ))}
        </ThemedView>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          {t('settings.language')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.section}>
          {languageOptions.map((option, index) => (
            <Pressable
              key={option.id}
              onPress={() => setLanguageId(option.id)}
              style={[styles.row, index > 0 && [styles.rowBorder, { borderColor: theme.backgroundSelected }]]}>
              <ThemedText>{option.label}</ThemedText>
              {languageId === option.id && <Ionicons name="checkmark" color={theme.accent} size={18} />}
            </Pressable>
          ))}
        </ThemedView>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          {t('settings.downloadsSection')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.section}>
          <View style={styles.row}>
            <ThemedText style={styles.switchLabel}>{t('settings.allowMobileData')}</ThemedText>
            <Switch
              value={allowMobileDataDownloads}
              onValueChange={setAllowMobileDataDownloads}
              trackColor={{ true: theme.accent }}
            />
          </View>
        </ThemedView>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
          {t('settings.updates')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.section}>
          <View style={styles.row}>
            <ThemedText style={styles.switchLabel}>
              {buildNumber > 0
                ? t('settings.versionBuild', { version: appVersion, stage: releaseStage, build: buildNumber })
                : t('settings.versionLocal', { version: appVersion, stage: releaseStage })}
            </ThemedText>
          </View>
          <View style={[styles.row, styles.rowBorder, { borderColor: theme.backgroundSelected }]}>
            <ThemedText style={styles.switchLabel}>{t('settings.autoCheck')}</ThemedText>
            <Switch
              value={autoCheckForUpdates}
              onValueChange={setAutoCheckForUpdates}
              trackColor={{ true: theme.accent }}
            />
          </View>
          <Pressable
            onPress={handleCheckNow}
            disabled={checking}
            style={[styles.row, styles.rowBorder, { borderColor: theme.backgroundSelected }]}>
            <ThemedText themeColor="accent">{checking ? t('settings.checking') : t('settings.checkNow')}</ThemedText>
            {checkResult !== 'idle' && (
              <ThemedText type="small" themeColor="textSecondary">
                {checkResult === 'upToDate'
                  ? t('settings.upToDate')
                  : t('settings.versionAvailable', { version: checkResult.version })}
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>
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
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
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
  switchLabel: {
    flex: 1,
    marginRight: Spacing.three,
  },
});
