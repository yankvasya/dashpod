import { Colors } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';

/** Reads the user's chosen theme (Settings screen) rather than following the OS color scheme —
 * the app defaults to light regardless of system dark mode, only changing on explicit choice. */
export function useTheme() {
  const { themeId } = useSettings();
  return Colors[themeId];
}
