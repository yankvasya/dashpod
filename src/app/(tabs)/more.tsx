import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const MORE_ITEMS = [
  { href: '/history', label: 'History', sf: 'clock', drawable: 'history' },
  { href: '/stats', label: 'Stats', sf: 'chart.pie', drawable: 'pie_chart' },
] as const;

export default function MoreScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          More
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.section}>
          {MORE_ITEMS.map((item, index) => (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href)}
              style={[
                styles.row,
                index > 0 && [styles.rowBorder, { borderColor: theme.backgroundSelected }],
              ]}>
              <SymbolView
                tintColor={theme.text}
                name={{ ios: item.sf, android: item.drawable, web: item.drawable }}
                size={20}
              />
              <ThemedText style={styles.rowLabel}>{item.label}</ThemedText>
              <SymbolView
                tintColor={theme.textSecondary}
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
              />
            </Pressable>
          ))}
        </ThemedView>
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
