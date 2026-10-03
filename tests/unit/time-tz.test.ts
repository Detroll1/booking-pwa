import {describe, expect, it} from 'vitest';
import {addZonedDays, fromZonedParts, startOfZonedDay, zonedDateKey, zonedParts} from '@/lib/time/tz';

const NY = 'America/New_York';

describe('timezone helpers', () => {
  it('round-trips wall-clock parts through a timezone', () => {
    const instant = fromZonedParts({year: 2026, month: 3, day: 10, hour: 9, minute: 30, second: 0}, NY);
    const parts = zonedParts(instant, NY);
    expect(parts).toMatchObject({year: 2026, month: 3, day: 10, hour: 9, minute: 30});
  });

  it('computes studio-local day boundaries across a DST change', () => {
    // 2026-03-08 is the US spring-forward day; local midnight exists.
    const noon = fromZonedParts({year: 2026, month: 3, day: 8, hour: 12, minute: 0, second: 0}, NY);
    const start = startOfZonedDay(noon, NY);
    expect(zonedParts(start, NY)).toMatchObject({year: 2026, month: 3, day: 8, hour: 0, minute: 0});
    expect(zonedDateKey(start, NY)).toBe('2026-03-08');
  });

  it('changes calendar date when the instant is late UTC', () => {
    // 2026-01-01T02:00Z is still 2025-12-31 in New York.
    const instant = new Date('2026-01-01T02:00:00Z');
    expect(zonedDateKey(instant, NY)).toBe('2025-12-31');
  });

  it('adds calendar days keeping the local clock time', () => {
    const start = fromZonedParts({year: 2026, month: 6, day: 1, hour: 10, minute: 0, second: 0}, NY);
    const next = addZonedDays(start, 3, NY);
    expect(zonedParts(next, NY)).toMatchObject({year: 2026, month: 6, day: 4, hour: 10, minute: 0});
  });
});
