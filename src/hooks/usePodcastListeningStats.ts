import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getPodcastListeningStats } from '@/db/queries';
import type { PodcastListeningStats } from '@/types/podcast';
import type { DateRange } from '@/utils/periods';

export function usePodcastListeningStats(range?: DateRange) {
  const db = useSQLiteContext();
  const [stats, setStats] = useState<PodcastListeningStats[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStats(await getPodcastListeningStats(db, range));
    } finally {
      setLoading(false);
    }
  }, [db, range]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { stats, loading, refresh };
}
