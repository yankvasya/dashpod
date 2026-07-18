import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type en from '@/i18n/locales/en';

type IconName = ComponentProps<typeof Ionicons>['name'];
type TabsTranslationKey = keyof typeof en.tabs;

const TABS = [
  { name: 'index', href: '/', labelKey: 'home', icon: 'home-outline' },
  { name: 'my-podcasts', href: '/my-podcasts', labelKey: 'myPodcasts', icon: 'library-outline' },
  { name: 'downloads', href: '/downloads', labelKey: 'downloads', icon: 'download-outline' },
  { name: 'queue', href: '/queue', labelKey: 'queue', icon: 'list-outline' },
  { name: 'more', href: '/more', labelKey: 'more', icon: 'ellipsis-horizontal-outline' },
] as const satisfies { name: string; href: string; labelKey: TabsTranslationKey; icon: IconName }[];

/** A hand-built tab bar instead of NativeTabs — NativeTabs renders each platform's real native
 * widget (UITabBar on iOS, Material's BottomNavigationView on Android), which look and animate
 * differently from each other by design and can't be reconciled through styling props. This is
 * the same underlying `expo-router/ui` primitive the web build already used, now shared by every
 * platform so the tab bar is pixel- and animation-identical everywhere. */
export default function AppTabs() {
  const { t } = useTranslation();

  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        <TabBar>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} label={t(`tabs.${tab.labelKey}`)} />
            </TabTrigger>
          ))}
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar({ children, ...props }: ComponentProps<typeof View>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...props}
      style={[
        styles.tabBar,
        { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected, paddingBottom: insets.bottom },
      ]}>
      {children}
    </View>
  );
}

function TabButton({ icon, label, isFocused, ...props }: TabTriggerSlotProps & { icon: IconName; label: string }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  scale.value = withSpring(isFocused ? 1.1 : 1, { damping: 14, stiffness: 220 });
  const animatedIconStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const color = isFocused ? theme.accent : theme.textSecondary;

  return (
    <Pressable {...props} style={styles.tabButton}>
      <Reanimated.View style={animatedIconStyle}>
        <Ionicons name={icon} size={24} color={color} />
      </Reanimated.View>
      <ThemedText type="small" numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
    paddingBottom: Spacing.one,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
});
