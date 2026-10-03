import {describe, expect, it} from 'vitest';
import {appointmentStarts, coveredDateKeys, windowsForDate, type WeeklyHours} from '@/lib/time/workingHours';
import {zonedParts} from '@/lib/time/tz';

const tz = 'Europe/Moscow';
const weekly: WeeklyHours = {
  1: [{startMin: 10 * 60, endMin: 13 * 60}],
  2: [{startMin: 10 * 60, endMin: 20 * 60}],
  6: [{startMin: 12 * 60, endMin: 18 * 60}],
};

describe('working hours and appointment moments', () => {
  it('returns weekday windows and honours a closed exception', () => {
    // 2026-05-04 is a Monday.
    expect(windowsForDate('2026-05-04', weekly)).toEqual([{startMin: 600, endMin: 780}]);
    expect(windowsForDate('2026-05-04', weekly, [{date: '2026-05-04', isClosed: true}])).toEqual([]);
  });

  it('builds appointment starts on the configured step inside the window', () => {
    const starts = appointmentStarts('2026-05-04', [{startMin: 600, endMin: 780}], {stepMinutes: 30, durationMinutes: 60}, tz);
    const times = starts.map((d) => `${String(zonedParts(d, tz).hour).padStart(2, '0')}:${String(zonedParts(d, tz).minute).padStart(2, '0')}`);
    // Last start is 12:00 so the 60-min service finishes by 13:00.
    expect(times).toContain('10:00');
    expect(times).toContain('12:00');
    expect(times).not.toContain('12:30');
  });

  it('allows a multi-day service to start even if it runs past closing time', () => {
    const starts = appointmentStarts('2026-05-04', [{startMin: 600, endMin: 780}], {stepMinutes: 60, durationMinutes: 60 * 30}, tz);
    expect(starts.length).toBeGreaterThan(0);
  });

  it('lists every studio-local date a multi-day interval covers', () => {
    const start = new Date('2026-05-04T07:00:00Z'); // 10:00 MSK
    const end = new Date('2026-05-06T07:00:00Z');
    expect(coveredDateKeys(start, end, tz)).toEqual(['2026-05-04', '2026-05-05', '2026-05-06']);
  });
});
