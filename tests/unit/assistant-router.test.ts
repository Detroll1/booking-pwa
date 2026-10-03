import {describe, expect, it} from 'vitest';
import {
  allowedTools,
  detectIntent,
  fallbackReply,
  isOwnerIntent,
} from '@/lib/assistant/router';

describe('assistant intent router', () => {
  it('routes client questions to the right intent', () => {
    expect(detectIntent('Когда ближайшее окно?')).toBe('availability');
    expect(detectIntent('Сколько стоит полировка?')).toBe('price');
    expect(detectIntent('Как найти студию?')).toBe('location');
    expect(detectIntent('Какой у вас график работы?')).toBe('hours');
  });

  it('routes owner questions to owner intents', () => {
    expect(isOwnerIntent(detectIntent('Что у меня завтра?'))).toBe(true);
    expect(detectIntent('Сколько машин было на неделе?')).toBe('owner_week');
    expect(detectIntent('Сколько денег получено?')).toBe('owner_money');
  });

  it('separates client and owner tool sets by permission', () => {
    expect(allowedTools('client')).not.toContain('get_stats');
    expect(allowedTools('owner')).toContain('get_stats');
    expect(allowedTools('client')).toContain('get_availability');
  });

  it('produces a data-grounded fallback reply, never inventing slots', () => {
    const empty = fallbackReply('availability', {slots: []});
    expect(empty).toMatch(/не нашлось/i);
    const filled = fallbackReply('availability', {slots: ['5 мая 10:00']});
    expect(filled).toContain('5 мая 10:00');
  });

  it('labels upcoming value as not revenue', () => {
    const reply = fallbackReply('owner_money', {receivedLabel: '10 000 ₽', upcomingLabel: '5 000 ₽'});
    expect(reply).toContain('не выручка');
  });
});
