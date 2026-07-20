/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export interface ThemePalette {
  text: string;
  background: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
  accent: string;
  danger: string;
  /** Which of react-navigation's DarkTheme/DefaultTheme this palette should drive (status bar,
   * native chrome) — see RootLayoutContent in _layout.tsx. */
  isDark: boolean;
}

export const Colors = {
  light: {
    text: '#000000',
    background: '#FFFFFF',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    accent: '#6C63FF',
    danger: '#FF3B30',
    isDark: false,
  },
  cream: {
    text: '#2B2620',
    background: '#FBF8F3',
    backgroundElement: '#F0EAE0',
    backgroundSelected: '#E3DACB',
    textSecondary: '#7A6F60',
    accent: '#D97757',
    danger: '#D64545',
    isDark: false,
  },
  slate: {
    text: '#10151F',
    background: '#F4F6F9',
    backgroundElement: '#E7EBF1',
    backgroundSelected: '#D7DEE8',
    textSecondary: '#5B6577',
    accent: '#2F80ED',
    danger: '#E5484D',
    isDark: false,
  },
  // "Dark Purple" — softened from pure black (#000000) after feedback that it was too harsh.
  dark: {
    text: '#FFFFFF',
    background: '#121214',
    backgroundElement: '#1E1E22',
    backgroundSelected: '#2A2A30',
    textSecondary: '#B0B4BA',
    accent: '#6C63FF',
    danger: '#FF453A',
    isDark: true,
  },
  midnightBlue: {
    text: '#EAF0FF',
    background: '#0B1220',
    backgroundElement: '#131C2E',
    backgroundSelected: '#1C2740',
    textSecondary: '#8A97B3',
    accent: '#4C8DFF',
    danger: '#FF6B6B',
    isDark: true,
  },
  forest: {
    text: '#E8F5EE',
    background: '#05130D',
    backgroundElement: '#0E211A',
    backgroundSelected: '#163527',
    textSecondary: '#8FB3A2',
    accent: '#2FBF71',
    danger: '#FF7A7A',
    isDark: true,
  },
  // The other three dark themes are all near-black — this one is a genuinely lighter, "dimmed"
  // dark theme (mid-gray rather than near-black background) for people who find those too dark.
  graphite: {
    text: '#F2F2F2',
    background: '#26262A',
    backgroundElement: '#323238',
    backgroundSelected: '#3E3E46',
    textSecondary: '#A6A6AE',
    accent: '#F0A83C',
    danger: '#FF6B57',
    isDark: true,
  },
} as const satisfies Record<string, ThemePalette>;

export type AppThemeId = keyof typeof Colors;
export type ThemeColor = Exclude<keyof ThemePalette, 'isDark'>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/** Bundled Inter weights (see ThemedText) — used everywhere instead of the OS system font
 * (San Francisco on iOS, Roboto on Android) so text renders identically on every platform. */
export const FontFamily = {
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

// Both now a single unified value — the tab bar itself (app-tabs.tsx) is a custom JS-rendered
// component identical on every platform, not each OS's native tab bar widget, so there's no
// longer a per-platform height to account for.
export const BottomTabInset = 80;
/** Tab bar content height only, excluding the safe-area bottom inset — combine with `useSafeAreaInsets().bottom` for absolute positioning above the tab bar. */
export const BottomTabBarHeight = 56;
/** Mini player's own height plus its gap above the tab bar — add to a list's bottom padding whenever `usePlayer().nowPlaying` is set, so the last row isn't hidden underneath it. */
export const MiniPlayerHeight = 64;
