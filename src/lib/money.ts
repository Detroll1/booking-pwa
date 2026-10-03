/**
 * Money is always handled as integer minor units (kopecks/cents).
 * Prices come from the database; the client never computes or sends a price.
 */

export type Minor = number;

const MINOR_PER_UNIT = 100;

export function formatMoney(minor: Minor, currency: string, locale = 'ru-RU'): string {
  const hasFraction = Math.abs(minor) % MINOR_PER_UNIT !== 0;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(minor / MINOR_PER_UNIT);
}

/** Parse a human-entered amount ("3 500", "3 500,50", "3500.50") into minor units. */
export function parseMoneyToMinor(input: string | number): Minor | null {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * MINOR_PER_UNIT);
  }
  const cleaned = input
    .replace(/\s|\u00a0/g, '')
    .replace(/,/g, '.')
    .replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * MINOR_PER_UNIT);
}

/** Round a fractional minor amount to the nearest integer minor unit. */
export function roundMinor(value: number): Minor {
  return Math.round(value);
}

export function sumMinor(values: readonly Minor[]): Minor {
  return values.reduce((acc, value) => acc + value, 0);
}
