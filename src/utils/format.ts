export function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

/** "12/34 min" — position/duration in whole minutes, for rows with a partially-listened episode. */
export function formatProgress(positionSeconds: number, durationSeconds: number): string {
  const positionMinutes = Math.round(positionSeconds / 60);
  const durationMinutes = Math.round(durationSeconds / 60);
  return `${positionMinutes}/${durationMinutes} min`;
}

export function formatDate(unixSeconds: number): string {
  if (!unixSeconds) return '';
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

/** "Today" / "Yesterday" / "Mon, Jan 5" — for the "YYYY-MM-DD" strings DayStats.date uses. */
export function formatHistoryDay(dateString: string): string {
  const target = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === yesterday.getTime()) return 'Yesterday';
  return target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
