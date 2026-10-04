import {formatInTimeZone, fromZonedTime, toZonedTime} from 'date-fns-tz';
import {ru} from 'date-fns/locale';

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const pad = (n: number, len = 2): string => String(n).padStart(len, '0');

/** Wall-clock parts of an instant, as seen in the studio timezone. */
export function zonedParts(instant: Date, timeZone: string): ZonedParts {
  const zoned = toZonedTime(instant, timeZone);
  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hour: zoned.getHours(),
    minute: zoned.getMinutes(),
    second: zoned.getSeconds(),
  };
}

/** Calendar day key (yyyy-MM-dd) in the studio timezone. */
export function zonedDateKey(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'yyyy-MM-dd');
}

/** Format an instant using a date-fns format string in the studio timezone (Russian locale). */
export function formatZoned(instant: Date, format: string, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, format, {locale: ru});
}

/** Build a UTC instant from wall-clock parts interpreted in the studio timezone. */
export function fromZonedParts(parts: ZonedParts, timeZone: string): Date {
  const iso = `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(
    parts.minute,
  )}:${pad(parts.second)}`;
  return fromZonedTime(iso, timeZone);
}

/** Build a UTC instant from a date key plus minutes-from-midnight in the studio timezone. */
export function fromZonedDayMinutes(dateKey: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = dateKey.split('-').map((value) => Number.parseInt(value, 10));
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y + m + d)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const totalMinutes = minutes;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return fromZonedParts({year: y, month: m, day: d, hour, minute, second: 0}, timeZone);
}

/** Start of the studio-local day (00:00) that contains the instant. */
export function startOfZonedDay(instant: Date, timeZone: string): Date {
  const parts = zonedParts(instant, timeZone);
  return fromZonedParts({...parts, hour: 0, minute: 0, second: 0}, timeZone);
}

/** End of the studio-local day (next 00:00) that contains the instant. */
export function endOfZonedDay(instant: Date, timeZone: string): Date {
  const start = startOfZonedDay(instant, timeZone);
  return addZonedDays(start, 1, timeZone);
}

/** Add whole calendar days in the studio timezone (keeps the local clock time). */
export function addZonedDays(instant: Date, days: number, timeZone: string): Date {
  const parts = zonedParts(instant, timeZone);
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return fromZonedParts(
    {
      ...parts,
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth() + 1,
      day: shifted.getUTCDate(),
    },
    timeZone,
  );
}

/** Offset in minutes between the studio timezone and UTC at the given instant. */
export function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const zoned = toZonedTime(instant, timeZone);
  return (zoned.getTime() - instant.getTime()) / 60000;
}
