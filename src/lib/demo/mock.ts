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
  serviceName: 'Комплексная мойка',
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
    heroImageUrl: null,
    logoUrl: null,
    social: {},
    bookingLeadMinutes: 60,
    cancelWindowMinutes: 180,
    slotStepMinutes: 30,
    hoursSummary: ['Пн–Сб: 09:00–21:00'],
    serviceCount: 4,
    resourceCount: 3,
    minPriceMinor: 350000,
    infoCards: [
      {id: 'c1', title: 'Бокс закреплён за вами', body: 'Машина занимает бокс на всё время услуги.', icon: 'shield'},
      {id: 'c2', title: 'Честные сроки', body: 'Керамика — от двух дней.', icon: 'clock'},
      {id: 'c3', title: 'Материалы студии', body: 'Профессиональная химия.', icon: 'sparkle'},
    ],
  },
  services: [
    {id: 's1', name: 'Комплексная мойка', description: 'Кузов, диски, салон, воск', priceMinor: 350000, currency: 'RUB', durationMinutes: 90, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay', sort: 1},
    {id: 's2', name: 'Полировка кузова', description: 'Абразивная полировка в 2 этапа', priceMinor: 1800000, currency: 'RUB', durationMinutes: 300, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 2},
    {id: 's3', name: 'Керамическое покрытие', description: 'Двухдневная защита кузова', priceMinor: 6500000, currency: 'RUB', durationMinutes: 2880, bufferBeforeMinutes: 60, bufferAfterMinutes: 60, resourceKind: 'station', sort: 3},
    {id: 's4', name: 'Химчистка салона', description: 'Текстиль и кожа', priceMinor: 1200000, currency: 'RUB', durationMinutes: 240, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, resourceKind: 'bay', sort: 4},
  ],
  works: [],
  serverTime: new Date().toISOString(),
};

const AVAILABILITY = {
  timezone: 'Europe/Moscow',
  serviceId: 's1',
  durationMinutes: 90,
  days: [{date: DAY, isClosed: false, slots: [nextSlot(10, 0), nextSlot(11, 30), nextSlot(13, 0), nextSlot(15, 0)]}],
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
