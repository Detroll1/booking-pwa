import {describe, expect, it} from 'vitest';
import {makeInterval, mergeIntervals, occupancyInterval, overlaps, subtractInterval, totalMinutes} from '@/lib/time/intervals';

describe('resource occupancy intervals', () => {
  it('includes preparation buffer around the service', () => {
    const occ = occupancyInterval(new Date('2026-05-01T10:00:00Z'), 60, 15, 30);
    expect(occ.start).toBe(Date.parse('2026-05-01T09:45:00Z'));
    expect(occ.end).toBe(Date.parse('2026-05-01T11:30:00Z'));
  });

  it('treats touching intervals as non-overlapping (half-open)', () => {
    const a = makeInterval(new Date('2026-05-01T10:00:00Z'), new Date('2026-05-01T11:00:00Z'));
    const b = makeInterval(new Date('2026-05-01T11:00:00Z'), new Date('2026-05-01T12:00:00Z'));
    expect(overlaps(a, b)).toBe(false);
  });

  it('keeps a multi-day occupancy continuous', () => {
    const occ = occupancyInterval(new Date('2026-05-01T14:00:00Z'), 60 * 40, 0, 60);
    expect((occ.end - occ.start) / 3_600_000).toBeCloseTo(41, 5);
  });

  it('merges and subtracts busy blocks from free time', () => {
    const free = makeInterval(new Date('2026-05-01T09:00:00Z'), new Date('2026-05-01T18:00:00Z'));
    const busy = [
      makeInterval(new Date('2026-05-01T10:00:00Z'), new Date('2026-05-01T11:00:00Z')),
      makeInterval(new Date('2026-05-01T10:30:00Z'), new Date('2026-05-01T12:00:00Z')),
      makeInterval(new Date('2026-05-01T15:00:00Z'), new Date('2026-05-01T16:00:00Z')),
    ];
    const merged = mergeIntervals(busy);
    expect(merged).toHaveLength(2);
    const remaining = subtractInterval(free, busy);
    expect(totalMinutes(remaining)).toBe(9 * 60 - 3 * 60);
    expect(remaining[0]?.start).toBe(Date.parse('2026-05-01T09:00:00Z'));
    expect(remaining[0]?.end).toBe(Date.parse('2026-05-01T10:00:00Z'));
  });
});
