import {describe, expect, it} from 'vitest';
import {formatMoney, parseMoneyToMinor, roundMinor, sumMinor} from '@/lib/money';

describe('money', () => {
  it('formats whole rubles without kopecks', () => {
    const formatted = formatMoney(350000, 'RUB', 'ru-RU');
    expect(formatted.replace(/\u00a0/g, ' ')).toContain('3');
    expect(formatted).not.toContain(',00');
  });

  it('formats kopecks when present', () => {
    const formatted = formatMoney(350050, 'RUB', 'ru-RU');
    expect(formatted).toMatch(/50/);
  });

  it('parses human input into minor units', () => {
    expect(parseMoneyToMinor('3 500')).toBe(350000);
    expect(parseMoneyToMinor('3 500,50')).toBe(350050);
    expect(parseMoneyToMinor('3500.50')).toBe(350050);
    expect(parseMoneyToMinor('')).toBeNull();
    expect(parseMoneyToMinor('abc')).toBeNull();
  });

  it('rounds fractional minor units and sums', () => {
    expect(roundMinor(100.4)).toBe(100);
    expect(roundMinor(100.6)).toBe(101);
    expect(sumMinor([100, 250, 50])).toBe(400);
  });
});
