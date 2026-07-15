import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { getAllSettings, setSetting } from '@/db/queries';

/** Reuses the existing light/dark color palettes in theme.ts — 'dark' is labelled "Dark Purple"
 * in the Settings UI, since its accent color already matches. */
export type AppThemeId = 'light' | 'dark';

const THEME_KEY = 'themeId';
const ALLOW_MOBILE_DATA_DOWNLOADS_KEY = 'allowMobileDataDownloads';
const AUTO_CHECK_FOR_UPDATES_KEY = 'autoCheckForUpdates';
const DEFAULT_THEME: AppThemeId = 'light';
// Conservative default — most podcast apps default to WiFi-only downloads.
const DEFAULT_ALLOW_MOBILE_DATA_DOWNLOADS = false;
const DEFAULT_AUTO_CHECK_FOR_UPDATES = true;

interface SettingsContextValue {
  loading: boolean;
  themeId: AppThemeId;
  setThemeId: (themeId: AppThemeId) => void;
  allowMobileDataDownloads: boolean;
  setAllowMobileDataDownloads: (allow: boolean) => void;
  autoCheckForUpdates: boolean;
  setAutoCheckForUpdates: (autoCheck: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** Wraps the app so theme and download preferences are available everywhere (useTheme reads
 * themeId from here instead of following the OS color scheme). */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [loading, setLoading] = useState(true);
  const [themeId, setThemeIdState] = useState<AppThemeId>(DEFAULT_THEME);
  const [allowMobileDataDownloads, setAllowMobileDataDownloadsState] = useState(
    DEFAULT_ALLOW_MOBILE_DATA_DOWNLOADS
  );
  const [autoCheckForUpdates, setAutoCheckForUpdatesState] = useState(DEFAULT_AUTO_CHECK_FOR_UPDATES);

  useEffect(() => {
    getAllSettings(db).then((settings) => {
      if (settings[THEME_KEY] === 'light' || settings[THEME_KEY] === 'dark') {
        setThemeIdState(settings[THEME_KEY]);
      }
      if (settings[ALLOW_MOBILE_DATA_DOWNLOADS_KEY] != null) {
        setAllowMobileDataDownloadsState(settings[ALLOW_MOBILE_DATA_DOWNLOADS_KEY] === '1');
      }
      if (settings[AUTO_CHECK_FOR_UPDATES_KEY] != null) {
        setAutoCheckForUpdatesState(settings[AUTO_CHECK_FOR_UPDATES_KEY] === '1');
      }
      setLoading(false);
    });
  }, [db]);

  const setThemeId = useCallback(
    (id: AppThemeId) => {
      setThemeIdState(id);
      setSetting(db, THEME_KEY, id);
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

  const value = useMemo(
    () => ({
      loading,
      themeId,
      setThemeId,
      allowMobileDataDownloads,
      setAllowMobileDataDownloads,
      autoCheckForUpdates,
      setAutoCheckForUpdates,
    }),
    [
      loading,
      themeId,
      setThemeId,
      allowMobileDataDownloads,
      setAllowMobileDataDownloads,
      autoCheckForUpdates,
      setAutoCheckForUpdates,
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
