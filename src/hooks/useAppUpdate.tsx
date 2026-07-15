import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useSettings } from '@/hooks/useSettings';
import { fetchLatestRelease, isNewerBuildAvailable, type ReleaseInfo } from '@/services/updateCheck';

interface AppUpdateContextValue {
  /** Set only when there's a genuinely newer build and the banner hasn't been dismissed this
   * session — drives the dismissible UpdateBanner. */
  updateAvailable: ReleaseInfo | null;
  checking: boolean;
  /** Runs a check and returns the result directly, regardless of dismissal state — for the
   * Settings screen's manual "Check for Updates" button, which wants to show "you're up to date"
   * too, not just silence when there's nothing new. Also updates updateAvailable as a side effect. */
  checkNow: () => Promise<ReleaseInfo | null>;
  dismiss: () => void;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

/** Wraps the app so the update banner and Settings' update section share one check — checks once
 * automatically per app session (when the "auto check" setting is on) and exposes a manual
 * re-check for Settings. */
export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const { autoCheckForUpdates, loading: settingsLoading } = useSettings();
  const [updateAvailable, setUpdateAvailable] = useState<ReleaseInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const checkNow = useCallback(async () => {
    setChecking(true);
    try {
      const latest = await fetchLatestRelease();
      if (latest && isNewerBuildAvailable(latest)) {
        setUpdateAvailable(latest);
        setDismissed(false);
        return latest;
      }
      setUpdateAvailable(null);
      return null;
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (settingsLoading || !autoCheckForUpdates) return;
    checkNow();
    // Intentionally runs once per app session as soon as settings are loaded (and again only if
    // the auto-check preference itself flips on) — not on every checkNow identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoading, autoCheckForUpdates]);

  const dismiss = useCallback(() => setDismissed(true), []);

  const value = useMemo(
    () => ({ updateAvailable: dismissed ? null : updateAvailable, checking, checkNow, dismiss }),
    [updateAvailable, checking, checkNow, dismiss, dismissed]
  );

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdate(): AppUpdateContextValue {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within an AppUpdateProvider');
  }
  return context;
}
