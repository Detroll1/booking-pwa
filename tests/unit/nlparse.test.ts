import {describe, expect, it} from 'vitest';
import {filterSlots, parseRequest} from '@/lib/assistant/nlparse';

describe('free assistant natural-language parsing', () => {
  it('extracts service, day and after-hour from "хочу мойку завтра после 6"', () => {
    const p = parseRequest('Хочу мойку завтра после 6:00');
    expect(p.serviceKeyword).toBe('мойка');
    expect(p.day).toBe('tomorrow');
    expect(p.afterHour).toBe(6);
  });

  it('recognises before-hour and слово-часы', () => {
    const p = parseRequest('полировка завтра до шести');
    expect(p.serviceKeyword).toBe('полировка');
    expect(p.beforeHour).toBe(6);
  });

  it('filters slot list by the window', () => {
    const p = parseRequest('мойка завтра после 18');
    const slots = [
      {iso: 'a', dayLabel: 'завтра 10:00', hour: 10},
      {iso: 'b', dayLabel: 'завтра 19:00', hour: 19},
      {iso: 'c', dayLabel: 'сегодня 19:00', hour: 19},
    ];
    const result = filterSlots(p, slots);
    expect(result.map((s) => s.iso)).toEqual(['b']);
  });
});
