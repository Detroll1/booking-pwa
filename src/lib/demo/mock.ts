import type {CallOptions} from '@/lib/api/client';

/**
 * Demo backend used only when the app is built/served without Supabase
 * (VITE_DEMO=true) or opened with ?fallback=1. It returns the same JSON shape
 * as the Edge Functions so every screen is fully explorable without a database.
 * Booking is local-only; no real notification or payment occurs.
 */
function nextSlot(hour: number, minute: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(hour - 3, minute, 0, 0);
  return d.toISOString();
}

const DAY = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

const BOOKING = {
  id: 'demo-booking',
  tenantSlug: 'graphite-detailing',
  status: 'confirmed',
  serviceName: 'Экспресс-мойка',
  customerName: 'Демо клиент',
  customerPhone: '+7 900 000-00-00',
  car: 'BMW X5',
  comment: null,
  startAt: nextSlot(10, 0),
  endAt: nextSlot(11, 30),
  durationMinutes: 90,
  priceMinor: 350000,
  currency: 'RUB',
  timezone: 'Europe/Moscow',
  address: 'Москва, ул. Автозаводская, 18',
  phone: '+7 495 000-10-10',
  resourceName: 'Бокс 1',
  canCancel: true,
  icsUrl: 'data:text/calendar,',
};

const CATALOG = {
  tenant: {
    slug: 'graphite-detailing',
    name: 'GRAPHITE Detailing',
    tagline: 'Детейлинг-студия полного цикла',
    description: 'Глубокая мойка, полировка и защитные покрытия. Бокс закреплён за вами на всё время услуги.',
    accent: '#4690ff',
    timezone: 'Europe/Moscow',
    currency: 'RUB',
    locale: 'ru-RU',
    status: 'live',
    phone: '+7 495 000-10-10',
    address: 'Москва, ул. Автозаводская, 18, бокс 4',
    mapUrl: null,
    heroImageUrl: '/hero.jpg',
    logoUrl: null,
    social: {},
    bookingLeadMinutes: 60,
    cancelWindowMinutes: 180,
    slotStepMinutes: 30,
    hoursSummary: ['Пн–Сб: 09:00–21:00'],
    serviceCount: 10,
    resourceCount: 3,
    minPriceMinor: 150000,
    infoCards: [
      {id: 'c1', title: 'Бокс закреплён за вами', body: 'Машина занимает бокс на всё время услуги.', icon: 'shield'},
      {id: 'c2', title: 'Честные сроки', body: 'Керамика — от двух дней.', icon: 'clock'},
      {id: 'c3', title: 'Материалы студии', body: 'Профессиональная химия.', icon: 'sparkle'},
    ],
  },
  services: [
    {id: 's1', name: 'Экспресс-мойка', description: 'Кузов и диски без очереди', priceMinor: 150000, currency: 'RUB', durationMinutes: 60, bufferBeforeMinutes: 5, bufferAfterMinutes: 5, resourceKind: 'bay', sort: 1},
    {id: 's2', name: 'Комплексная мойка', description: 'Кузов, диски, салон, воск', priceMinor: 350000, currency: 'RUB', durationMinutes: 90, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay', sort: 2},
    {id: 's3', name: 'Химчистка салона', description: 'Текстиль и кожа', priceMinor: 1200000, currency: 'RUB', durationMinutes: 240, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, resourceKind: 'bay', sort: 3},
    {id: 's4', name: 'Озонирование салона', description: 'Устранение запахов', priceMinor: 250000, currency: 'RUB', durationMinutes: 45, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay', sort: 4},
    {id: 's5', name: 'Полировка фар', description: 'Возврат прозрачности', priceMinor: 600000, currency: 'RUB', durationMinutes: 120, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, resourceKind: 'station', sort: 5},
    {id: 's6', name: 'Детейлинг дисков', description: 'Очистка и защита', priceMinor: 450000, currency: 'RUB', durationMinutes: 120, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'station', sort: 6},
    {id: 's7', name: 'Полировка кузова', description: 'Абразивная полировка в 2 этапа', priceMinor: 1800000, currency: 'RUB', durationMinutes: 300, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 7},
    {id: 's8', name: 'Керамическое покрытие', description: 'Защита кузова на 1 день', priceMinor: 3500000, currency: 'RUB', durationMinutes: 1440, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 8},
    {id: 's9', name: 'Керамика двухдневная', description: 'Максимальная защита', priceMinor: 6500000, currency: 'RUB', durationMinutes: 2880, bufferBeforeMinutes: 60, bufferAfterMinutes: 60, resourceKind: 'station', sort: 9},
    {id: 's10', name: 'Защитная плёнка', description: 'Бампер и зоны риска', priceMinor: 1500000, currency: 'RUB', durationMinutes: 360, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 10},
  ],
  works: [],
  serverTime: new Date().toISOString(),
};

const AVAILABILITY = {
  timezone: 'Europe/Moscow',
  serviceId: 's1',
  durationMinutes: 60,
  days: [
    {
      date: DAY,
      isClosed: false,
      slots: [9, 10, 11, 12, 13, 14, 15, 16].map((h) => nextSlot(h, 0)),
    },
  ],
};

const ASSISTANT = {
  reply: 'Это демонстрационный режим: помощник в рабочей версии отвечает по данным студии.',
  intent: 'unknown',
  usedTools: [],
  suggestions: ['Когда ближайшее окно?', 'Сколько стоит полировка?', 'Как найти студию?'],
};

export function demoReply<T>(name: string, options: CallOptions): Promise<T> {
  const body = (options.body ?? {}) as {action?: string; scope?: string};
  if (name === 'catalog') return Promise.resolve(CATALOG as T);
  if (name === 'availability') return Promise.resolve(AVAILABILITY as T);
  if (name === 'assistant') return Promise.resolve(ASSISTANT as T);
  if (name === 'bookings') {
    return Promise.resolve((body.action === 'create' ? {booking: BOOKING, accessToken: 'demo-access-token', replayed: false} : {booking: BOOKING}) as T);
  }
  return Promise.resolve({error: {code: 'demo', message: 'Демонстрационный режим: кабинет владельца доступен после подключения Supabase.'}} as T);
}
