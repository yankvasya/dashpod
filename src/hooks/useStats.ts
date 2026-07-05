import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';

import { getWeeklyStats } from '@/db/queries';
import type { DayStats } from '@/types/podcast';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMondayOfWeek(reference = new Date()): Date {
  const date = new Date(reference);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = (day + 6) % 7;
  date.setDate(date.getDate() - diffToMonday);
  return date;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useStats() {
  const db = useSQLiteContext();
  const [days, setDays] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const monday = getMondayOfWeek();
      const weekStartUnixSeconds = Math.floor(monday.getTime() / 1000);
      const stats = await getWeeklyStats(db, weekStartUnixSeconds);
      const byDate = new Map(stats.map((day) => [day.date, day]));

      const filled: DayStats[] = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(monday);
        date.setDate(date.getDate() + i);
        const key = formatLocalDate(date);
        return byDate.get(key) ?? { date: key, totalMinutes: 0, episodes: [] };
      });
      setDays(filled);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totalMinutes = days.reduce((sum, day) => sum + day.totalMinutes, 0);

  return { days, dayLabels: DAY_LABELS, totalMinutes, loading, refresh };
}
