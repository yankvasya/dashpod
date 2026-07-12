import { formatHistoryDay } from '@/utils/format';

export type PeriodType = 'day' | 'week' | 'month' | 'year' | 'all';

/** `anchor` is ignored when `type` is 'all'. For 'month'/'year', only the month/year of the
 * anchor matters — always kept normalized to the 1st to avoid day-of-month overflow when shifting. */
export interface Period {
  type: PeriodType;
  anchor: Date;
}

export interface DateRange {
  startUnixSeconds: number;
  endUnixSeconds: number;
}

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getMondayOfWeek(reference: Date): Date {
  const date = startOfDay(reference);
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

export function getPeriodRange(period: Period): DateRange | null {
  if (period.type === 'all') return null;

  let start: Date;
  let end: Date;
  switch (period.type) {
    case 'day':
      start = startOfDay(period.anchor);
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;
    case 'week':
      start = getMondayOfWeek(period.anchor);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    case 'month':
      start = new Date(period.anchor.getFullYear(), period.anchor.getMonth(), 1);
      end = new Date(period.anchor.getFullYear(), period.anchor.getMonth() + 1, 1);
      break;
    case 'year':
      start = new Date(period.anchor.getFullYear(), 0, 1);
      end = new Date(period.anchor.getFullYear() + 1, 0, 1);
      break;
  }
  return {
    startUnixSeconds: Math.floor(start.getTime() / 1000),
    endUnixSeconds: Math.floor(end.getTime() / 1000),
  };
}

const MONTH_DAY_SHORT = { month: 'short', day: 'numeric' } as const;

export function getPeriodLabel(period: Period): string {
  switch (period.type) {
    case 'day':
      return formatHistoryDay(formatLocalDate(period.anchor));
    case 'week': {
      const monday = getMondayOfWeek(period.anchor);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const sameMonth = monday.getMonth() === sunday.getMonth();
      const start = monday.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : MONTH_DAY_SHORT);
      const end = sunday.toLocaleDateString(undefined, MONTH_DAY_SHORT);
      return `${start} – ${end}`;
    }
    case 'month':
      return period.anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    case 'year':
      return String(period.anchor.getFullYear());
    case 'all':
      return 'All Time';
  }
}

export function shiftPeriod(period: Period, direction: 1 | -1): Period {
  if (period.type === 'all') return period;

  const anchor = new Date(period.anchor);
  switch (period.type) {
    case 'day':
      anchor.setDate(anchor.getDate() + direction);
      break;
    case 'week':
      anchor.setDate(anchor.getDate() + direction * 7);
      break;
    case 'month':
      return { type: 'month', anchor: new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1) };
    case 'year':
      return { type: 'year', anchor: new Date(anchor.getFullYear() + direction, 0, 1) };
  }
  return { type: period.type, anchor };
}
