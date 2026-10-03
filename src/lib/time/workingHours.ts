import {addZonedDays, fromZonedDayMinutes, zonedDateKey} from './tz';

/** Minutes from local midnight. */
export interface DayWindow {
  startMin: number;
  endMin: number;
}

export type WeeklyHours = Readonly<Record<number, readonly DayWindow[] | undefined>>;

export interface ScheduleException {
  /** Studio-local date key yyyy-MM-dd. */
  date: string;
  isClosed: boolean;
  /** Present when isClosed=false: replaces the weekday windows for that date. */
  windows?: readonly DayWindow[];
}

export interface AppointmentRules {
  /** Slot granularity in minutes. */
  stepMinutes: number;
  /** Service duration in minutes. */
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}

/** Working windows for a given studio-local date, honouring exceptions. */
export function windowsForDate(
  dateKey: string,
  weekly: WeeklyHours,
  exceptions: readonly ScheduleException[] = [],
): DayWindow[] {
  const exception = exceptions.find((e) => e.date === dateKey);
  if (exception) {
    if (exception.isClosed) return [];
    return [...(exception.windows ?? [])];
  }
  const [y, m, d] = dateKey.split('-').map((v) => Number.parseInt(v, 10));
  if (y === undefined || m === undefined || d === undefined) return [];
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return [...(weekly[weekday] ?? [])];
}

export function windowsLengthMinutes(windows: readonly DayWindow[]): number {
  return windows.reduce((acc, w) => acc + Math.max(0, w.endMin - w.startMin), 0);
}

function alignToStep(minutes: number, step: number): number {
  return Math.ceil(minutes / step) * step;
}

/**
 * Appointment start instants available on a given studio-local date for a service.
 * A start must fall inside a working window. When the service fits inside the
 * remaining window it must finish before closing; a service longer than a full
 * day's window is treated as an overnight/multi-day job and may run past close.
 */
export function appointmentStarts(
  dateKey: string,
  windows: readonly DayWindow[],
  rules: AppointmentRules,
  timeZone: string,
): Date[] {
  const step = Math.max(1, rules.stepMinutes);
  const duration = Math.max(1, rules.durationMinutes);
  const overnight = duration > windowsLengthMinutes(windows);
  const starts: number[] = [];
  for (const window of windows) {
    const first = alignToStep(window.startMin, step);
    for (let minute = first; minute + 0 < window.endMin; minute += step) {
      const finishesInside = minute + duration <= window.endMin;
      if (!finishesInside && !overnight) continue;
      starts.push(minute);
    }
  }
  const unique = [...new Set(starts)].sort((a, b) => a - b);
  return unique.map((minute) => fromZonedDayMinutes(dateKey, minute, timeZone));
}

/** The studio-local date keys covered by a continuous interval [start, end). */
export function coveredDateKeys(start: Date, end: Date, timeZone: string, maxDays = 14): string[] {
  if (!(end.getTime() > start.getTime())) return [zonedDateKey(start, timeZone)];
  const keys: string[] = [];
  const lastKey = zonedDateKey(new Date(end.getTime() - 1), timeZone);
  let cursor = start;
  for (let i = 0; i < maxDays; i += 1) {
    const key = zonedDateKey(cursor, timeZone);
    keys.push(key);
    if (key === lastKey) break;
    cursor = addZonedDays(cursor, 1, timeZone);
  }
  return [...new Set(keys)];
}
