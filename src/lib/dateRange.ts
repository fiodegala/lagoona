import { startOfDay, endOfDay, startOfWeek, startOfMonth, subDays } from 'date-fns';

export type PeriodFilter = 'today' | 'yesterday' | 'week' | 'month' | '30days' | 'custom';

/**
 * Parse an ISO date string ("YYYY-MM-DD") from an <input type="date"> as a
 * LOCAL date. `new Date("YYYY-MM-DD")` parses as UTC midnight, which in
 * negative-offset timezones (e.g. America/Sao_Paulo, UTC-3) yields the
 * previous calendar day. Appending the time component forces local parsing.
 */
export function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export interface DateRange {
  start: Date;
  end: Date;
}

export function computeDateRange(
  period: PeriodFilter,
  customStart: string,
  customEnd: string,
  now: Date = new Date(),
): DateRange {
  switch (period) {
    case 'today':
      return { start: startOfDay(now), end: endOfDay(now) };
    case 'yesterday':
      return { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) };
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfDay(now) };
    case 'month':
      return { start: startOfMonth(now), end: endOfDay(now) };
    case '30days':
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case 'custom':
      return {
        start: customStart ? startOfDay(parseLocalDate(customStart)) : startOfDay(subDays(now, 30)),
        end: customEnd ? endOfDay(parseLocalDate(customEnd)) : endOfDay(now),
      };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}
