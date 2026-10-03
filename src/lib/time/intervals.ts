/** Half-open time intervals [start, end) in epoch milliseconds. */

export interface Interval {
  start: number;
  end: number;
}

export function makeInterval(start: Date | number, end: Date | number): Interval {
  const s = start instanceof Date ? start.getTime() : start;
  const e = end instanceof Date ? end.getTime() : end;
  if (!(e > s)) {
    throw new Error(`Invalid interval: end (${e}) must be after start (${s})`);
  }
  return {start: s, end: e};
}

export function durationMs(minutes: number): number {
  return minutes * 60_000;
}

/** Services occupy [start - bufferBefore, start + duration + bufferAfter). */
export function occupancyInterval(
  start: Date,
  durationMinutes: number,
  bufferBeforeMinutes = 0,
  bufferAfterMinutes = 0,
): Interval {
  const s = start.getTime() - durationMs(bufferBeforeMinutes);
  const e = start.getTime() + durationMs(durationMinutes + bufferAfterMinutes);
  return makeInterval(s, e);
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function intersectsAny(target: Interval, others: readonly Interval[]): boolean {
  return others.some((other) => overlaps(target, other));
}

export function contains(outer: Interval, inner: Interval): boolean {
  return outer.start <= inner.start && inner.end <= outer.end;
}

export function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Interval[] = [];
  let current = sorted[0]!;
  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i]!;
    if (next.start <= current.end) {
      current = {start: current.start, end: Math.max(current.end, next.end)};
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);
  return merged;
}

/** Subtract busy intervals from a free interval, returning remaining free pieces. */
export function subtractInterval(free: Interval, busy: readonly Interval[]): Interval[] {
  const relevant = mergeIntervals(busy.filter((b) => overlaps(free, b)));
  const result: Interval[] = [];
  let cursor = free.start;
  for (const block of relevant) {
    if (block.start > cursor) {
      result.push({start: cursor, end: Math.min(block.start, free.end)});
    }
    cursor = Math.max(cursor, block.end);
    if (cursor >= free.end) break;
  }
  if (cursor < free.end) {
    result.push({start: cursor, end: free.end});
  }
  return result;
}

export function totalMinutes(intervals: readonly Interval[]): number {
  return mergeIntervals(intervals).reduce((acc, i) => acc + (i.end - i.start) / 60_000, 0);
}

/** True when the interval crosses at least one local midnight boundary. */
export function spansMultipleDays(interval: Interval, dayStarts: readonly number[]): boolean {
  return dayStarts.filter((d) => d > interval.start && d < interval.end).length > 0;
}
