import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getListeningHistory } from '@/db/queries';
import type { DayStats } from '@/types/podcast';
import type { DateRange } from '@/utils/periods';

export function useHistory(range?: DateRange) {
  const db = useSQLiteContext();
  const [days, setDays] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDays(await getListeningHistory(db, range));
    } finally {
      setLoading(false);
    }
  }, [db, range]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { days, loading, refresh };
}
