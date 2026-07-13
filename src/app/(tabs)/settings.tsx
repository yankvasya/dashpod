import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings, type AppThemeId } from '@/hooks/useSettings';

const THEME_OPTIONS: { id: AppThemeId; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark Purple' },
];

export default function SettingsScreen() {
  const theme = useTheme();
  const { themeId, setThemeId, allowMobileDataDownloads, setAllowMobileDataDownloads } = useSettings();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          Settings
        </ThemedText>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            Appearance
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.section}>
            {THEME_OPTIONS.map((option, index) => (
              <Pressable
                key={option.id}
                onPress={() => setThemeId(option.id)}
                style={[
                  styles.row,
                  index > 0 && [styles.rowBorder, { borderColor: theme.backgroundSelected }],
                ]}>
                <ThemedText>{option.label}</ThemedText>
                {themeId === option.id && (
                  <SymbolView
                    tintColor={theme.accent}
                    name={{ ios: 'checkmark', android: 'check', web: 'check' }}
                    size={18}
                  />
                )}
              </Pressable>
            ))}
          </ThemedView>

          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            Downloads
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.section}>
            <View style={styles.row}>
              <ThemedText style={styles.switchLabel}>Allow Downloads Over Mobile Data</ThemedText>
              <Switch
                value={allowMobileDataDownloads}
                onValueChange={setAllowMobileDataDownloads}
                trackColor={{ true: theme.accent }}
              />
            </View>
          </ThemedView>
        </ScrollView>
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
