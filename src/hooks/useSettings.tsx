import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { Colors, type AppThemeId } from '@/constants/theme';
import { getAllSettings, setSetting } from '@/db/queries';
import i18n from '@/i18n';

export type { AppThemeId };

const VALID_THEME_IDS = Object.keys(Colors) as AppThemeId[];

export type AppLanguageId = 'en' | 'ru';

/** Tabs that can be toggled between the main tab bar and the More menu — Home, My Podcasts, and
 * More itself are always pinned, not configurable. See app-tabs.tsx and more.tsx. */
export type OptionalTabId = 'downloads' | 'queue';

const THEME_KEY = 'themeId';
const LANGUAGE_KEY = 'languageId';
const ALLOW_MOBILE_DATA_DOWNLOADS_KEY = 'allowMobileDataDownloads';
const AUTO_CHECK_FOR_UPDATES_KEY = 'autoCheckForUpdates';
const PINNED_TABS_KEY = 'pinnedTabs';
const DEFAULT_THEME: AppThemeId = 'light';
const DEFAULT_LANGUAGE: AppLanguageId = 'en';
// Conservative default — most podcast apps default to WiFi-only downloads.
const DEFAULT_ALLOW_MOBILE_DATA_DOWNLOADS = false;
const DEFAULT_AUTO_CHECK_FOR_UPDATES = true;
// Matches the tab bar's shape before this setting existed, so upgrading users see no change.
const DEFAULT_PINNED_TABS: OptionalTabId[] = ['downloads', 'queue'];
const VALID_OPTIONAL_TAB_IDS: OptionalTabId[] = ['downloads', 'queue'];

interface SettingsContextValue {
  loading: boolean;
  themeId: AppThemeId;
  setThemeId: (themeId: AppThemeId) => void;
  languageId: AppLanguageId;
  setLanguageId: (languageId: AppLanguageId) => void;
  allowMobileDataDownloads: boolean;
  setAllowMobileDataDownloads: (allow: boolean) => void;
  autoCheckForUpdates: boolean;
  setAutoCheckForUpdates: (autoCheck: boolean) => void;
  pinnedTabs: OptionalTabId[];
  setPinnedTabs: (tabs: OptionalTabId[]) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Wraps the app so theme and download preferences are available everywhere (useTheme reads
 * themeId from here instead of following the OS color scheme). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [themeId, setThemeIdState] = useState<AppThemeId>(DEFAULT_THEME);
  const [languageId, setLanguageIdState] = useState<AppLanguageId>(DEFAULT_LANGUAGE);
  const [allowMobileDataDownloads, setAllowMobileDataDownloadsState] = useState(
    DEFAULT_ALLOW_MOBILE_DATA_DOWNLOADS
  );
  const [autoCheckForUpdates, setAutoCheckForUpdatesState] = useState(DEFAULT_AUTO_CHECK_FOR_UPDATES);
  const [pinnedTabs, setPinnedTabsState] = useState<OptionalTabId[]>(DEFAULT_PINNED_TABS);

  useEffect(() => {
    getAllSettings(db)
      .then((settings) => {
        if (VALID_THEME_IDS.includes(settings[THEME_KEY] as AppThemeId)) {
          setThemeIdState(settings[THEME_KEY] as AppThemeId);
        }
        if (settings[LANGUAGE_KEY] === 'en' || settings[LANGUAGE_KEY] === 'ru') {
          setLanguageIdState(settings[LANGUAGE_KEY]);
          i18n.changeLanguage(settings[LANGUAGE_KEY]);
        }
        if (settings[ALLOW_MOBILE_DATA_DOWNLOADS_KEY] != null) {
          setAllowMobileDataDownloadsState(settings[ALLOW_MOBILE_DATA_DOWNLOADS_KEY] === '1');
        }
        if (settings[AUTO_CHECK_FOR_UPDATES_KEY] != null) {
          setAutoCheckForUpdatesState(settings[AUTO_CHECK_FOR_UPDATES_KEY] === '1');
        }
        if (settings[PINNED_TABS_KEY] != null) {
          const parsed = settings[PINNED_TABS_KEY]
            .split(',')
            .filter((id): id is OptionalTabId => VALID_OPTIONAL_TAB_IDS.includes(id as OptionalTabId));
          setPinnedTabsState(parsed);
        }
      })
      // Falls back to defaults on failure — still needs to clear `loading` no matter what,
      // since other screens (and now the splash-hide gate in _layout.tsx) wait on it.
      .finally(() => setLoading(false));
  }, [db]);

  const setThemeId = useCallback(
    (id: AppThemeId) => {
      setThemeIdState(id);
      setSetting(db, THEME_KEY, id);
    },
    [db]
  );

  const setLanguageId = useCallback(
    (id: AppLanguageId) => {
      setLanguageIdState(id);
      i18n.changeLanguage(id);
      setSetting(db, LANGUAGE_KEY, id);
    },
    [db]
  );

  const setAllowMobileDataDownloads = useCallback(
    (allow: boolean) => {
      setAllowMobileDataDownloadsState(allow);
      setSetting(db, ALLOW_MOBILE_DATA_DOWNLOADS_KEY, allow ? '1' : '0');
    },
    [db]
  );

  const setAutoCheckForUpdates = useCallback(
    (autoCheck: boolean) => {
      setAutoCheckForUpdatesState(autoCheck);
      setSetting(db, AUTO_CHECK_FOR_UPDATES_KEY, autoCheck ? '1' : '0');
    },
    [db]
  );

  const setPinnedTabs = useCallback(
    (tabs: OptionalTabId[]) => {
      setPinnedTabsState(tabs);
      setSetting(db, PINNED_TABS_KEY, tabs.join(','));
    },
    [db]
  );

  const value = useMemo(
    () => ({
      loading,
      themeId,
      setThemeId,
      languageId,
      setLanguageId,
      allowMobileDataDownloads,
      setAllowMobileDataDownloads,
      autoCheckForUpdates,
      setAutoCheckForUpdates,
      pinnedTabs,
      setPinnedTabs,
    }),
    [
      loading,
      themeId,
      languageId,
      setLanguageId,
      setThemeId,
      allowMobileDataDownloads,
      setAllowMobileDataDownloads,
      autoCheckForUpdates,
      setAutoCheckForUpdates,
      pinnedTabs,
      setPinnedTabs,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
