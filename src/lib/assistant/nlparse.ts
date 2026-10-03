import {detectIntent, type Intent} from './router';

/**
 * Free, dependency-free natural-language helpers for the assistant. No paid LLM:
 * we extract a service keyword and a rough time window from the phrase so the
 * assistant can propose a concrete slot, e.g. "хочу мойку завтра после 6".
 */

export interface ParsedRequest {
  intent: Intent;
  /** Best-effort service keyword found in the phrase. */
  serviceKeyword: string | null;
  /** Relative day request. */
  day: 'today' | 'tomorrow' | 'any';
  /** Earliest local hour (0-23) if the user said "после 6" etc. */
  afterHour: number | null;
  /** Latest local hour if the user said "до 18". */
  beforeHour: number | null;
}

const SERVICE_LEXICON: {keyword: string; patterns: RegExp[]}[] = [
  {keyword: 'мойка', patterns: [/мойк/i, /помыть/i, /wash/i]},
  {keyword: 'полировка', patterns: [/полиров/i, /полирн/i]},
  {keyword: 'керамика', patterns: [/керамик/i, /покрыти/i, /керамич/i]},
  {keyword: 'химчистка', patterns: [/химчист/i, /салон/i, /чистк/i]},
  {keyword: 'детейлинг', patterns: [/детейл/i, /полировк/i]},
  {keyword: 'полировка фар', patterns: [/фары/i, /фар/i]},
];

const hourWord: Record<string, number> = {
  'два': 2, 'две': 2, 'три': 3, 'четыре': 4, 'пять': 5, 'пяти': 5,
  'шесть': 6, 'шести': 6, 'семь': 7, 'семи': 7, 'восемь': 8, 'восьми': 8,
  'девять': 9, 'девяти': 9, 'десять': 10, 'десяти': 10,
  'одиннадцать': 11, 'двенадцать': 12,
};

function parseHour(text: string): number | null {
  const m = /(\d{1,2})(?::(\d{2}))?/.exec(text);
  if (m) {
    const h = Number.parseInt(m[1] ?? '', 10);
    if (h >= 0 && h <= 23) return h;
  }
  for (const [word, value] of Object.entries(hourWord)) {
    if (text.includes(word)) return value;
  }
  return null;
}

export function parseRequest(message: string): ParsedRequest {
  const text = message.toLowerCase();
  const intent = detectIntent(message);

  let serviceKeyword: string | null = null;
  for (const entry of SERVICE_LEXICON) {
    if (entry.patterns.some((p) => p.test(text))) {
      serviceKeyword = entry.keyword;
      break;
    }
  }

  const day: ParsedRequest['day'] = /завтра/.test(text)
    ? 'tomorrow'
    : /сегодня/.test(text)
      ? 'today'
      : 'any';

  const afterMatch = /(после|с)\s+([^\s,]+)/.exec(text);
  const beforeMatch = /до\s+([^\s,]+)/.exec(text);
  const afterHour = afterMatch ? parseHour(afterMatch[2] ?? '') : null;
  const beforeHour = beforeMatch ? parseHour(beforeMatch[1] ?? '') : null;

  return {intent, serviceKeyword, day, afterHour, beforeHour};
}

/** Filter concrete slot ISO strings by the parsed day/hour window (studio timezone). */
export function filterSlots(
  parsed: ParsedRequest,
  slots: {iso: string; dayLabel: string; hour: number}[],
): {iso: string; dayLabel: string; hour: number}[] {
  return slots.filter((slot) => {
    if (parsed.day === 'tomorrow' && !slot.dayLabel.startsWith('завтра')) return false;
    if (parsed.day === 'today' && !slot.dayLabel.startsWith('сегодня')) return false;
    if (parsed.afterHour !== null && slot.hour < parsed.afterHour) return false;
    if (parsed.beforeHour !== null && slot.hour > parsed.beforeHour) return false;
    return true;
  });
}
