// Pure, dependency-free intent router for the assistant. It is the canonical
// implementation: the Edge Function re-exports it, and it is unit-tested
// directly. It contains no DOM, no Deno, and no network code.

export type AssistantScope = 'client' | 'owner';

export type Intent =
  | 'services'
  | 'price'
  | 'availability'
  | 'location'
  | 'hours'
  | 'owner_today'
  | 'owner_week'
  | 'owner_money'
  | 'unknown';

const RULES: {intent: Intent; pattern: RegExp}[] = [
  {intent: 'owner_money', pattern: /(деньг|денег|выручк|получил|доход|оплат|касс)/i},
  {intent: 'owner_week', pattern: /(недел|за неделю|на этой недел)/i},
  {intent: 'owner_today', pattern: /(сегодня|на день|за день|завтра)/i},
  {intent: 'price', pattern: /(сколько|цена|цены|стоит|стоимость|прайс|почём|почем)/i},
  {intent: 'availability', pattern: /(окно|свобод|когда|запис|ближайш|есть время|окошк)/i},
  {intent: 'location', pattern: /(где|адрес|найти|добраться|доехать|как проехать)/i},
  {intent: 'hours', pattern: /(график|часы|работаете|открыт|закрыт|во сколько)/i},
  {intent: 'services', pattern: /(услуг|делаете|предлагаете|работ|полировк|мойк|керамик|химчистк)/i},
];

export function detectIntent(message: string): Intent {
  const m = message.toLowerCase();
  for (const rule of RULES) {
    if (rule.pattern.test(m)) return rule.intent;
  }
  return 'unknown';
}

export function isOwnerIntent(intent: Intent): boolean {
  return intent === 'owner_today' || intent === 'owner_week' || intent === 'owner_money';
}

export function allowedTools(scope: AssistantScope): string[] {
  return scope === 'owner'
    ? ['get_services', 'get_stats', 'get_schedule', 'get_tenant_info']
    : ['get_services', 'get_availability', 'get_tenant_info'];
}

export interface FallbackData {
  serviceName?: string;
  services?: {name: string; priceLabel: string; durationMinutes: number}[];
  slots?: string[];
  address?: string | null;
  phone?: string | null;
  hours?: string[];
  arrived?: number;
  completed?: number;
  receivedLabel?: string;
  todayCount?: number;
  upcomingLabel?: string;
}

export function fallbackReply(intent: Intent, data: FallbackData): string {
  switch (intent) {
    case 'price':
    case 'services': {
      if (!data.services?.length) return 'Пока не вижу услуг в каталоге этой студии. Уточните, что вас интересует.';
      const lines = data.services.map((s) => `${s.name} — ${s.priceLabel} (${s.durationMinutes} мин)`);
      return `Вот услуги и цены:\n${lines.join('\n')}`;
    }
    case 'availability': {
      if (!data.slots?.length) return 'На ближайшие дни свободных окон не нашлось. Попробуйте выбрать другую дату.';
      const who = data.serviceName ? ` на «${data.serviceName}»` : '';
      return `Свободные окна${who}: ${data.slots.slice(0, 5).join(', ')}. Откройте «Записаться», чтобы подтвердить.`;
    }
    case 'location': {
      if (!data.address) return 'Адрес пока не указан в настройках студии.';
      return `Студия находится по адресу: ${data.address}${data.phone ? `. Телефон: ${data.phone}` : ''}.`;
    }
    case 'hours': {
      if (!data.hours?.length) return 'График работы пока не заполнен.';
      return `График работы:\n${data.hours.join('\n')}`;
    }
    case 'owner_today':
      return `На сегодня записей: ${data.todayCount ?? 0}.`;
    case 'owner_week':
      return `За период: заездов ${data.arrived ?? 0}, выполнено ${data.completed ?? 0}.`;
    case 'owner_money':
      return `Получено денег за период: ${data.receivedLabel ?? '0 ₽'}. Стоимость будущих записей: ${data.upcomingLabel ?? '0 ₽'} (это ещё не выручка).`;
    default:
      return 'Я помогаю с услугами, свободным временем и адресом этой студии. Уточните вопрос, например: «Когда ближайшее окно?»';
  }
}

export const CLIENT_SUGGESTIONS = ['Когда ближайшее окно?', 'Сколько стоит полировка?', 'Как найти студию?'];
export const OWNER_SUGGESTIONS = ['Что у меня завтра?', 'Сколько машин было на неделе?', 'Сколько денег получено?'];
