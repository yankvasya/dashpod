import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getListeningHistory } from '@/db/queries';
import type { DayStats } from '@/types/podcast';

export function useHistory() {
  const db = useSQLiteContext();
  const [days, setDays] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDays(await getListeningHistory(db));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { days, loading, refresh };
}
