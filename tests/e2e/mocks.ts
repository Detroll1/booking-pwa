import type {Page} from '@playwright/test';

const TZ = 'Europe/Moscow';

function slot(hour: number, minute: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 1);
  day.setUTCHours(hour - 3, minute, 0, 0); // Moscow is UTC+3
  return day.toISOString();
}

export const MOCK_BOOKING = {
  id: 'b0000000-0000-0000-0000-000000000001',
  tenantSlug: 'graphite-detailing',
  status: 'confirmed',
  serviceName: 'Экспресс-мойка',
  customerName: 'Тест Клиент',
  customerPhone: '+7 900 111-22-33',
  car: 'BMW X5',
  comment: null,
  startAt: slot(10, 0),
  endAt: slot(11, 30),
  durationMinutes: 90,
  priceMinor: 350000,
  currency: 'RUB',
  timezone: TZ,
  address: 'Москва, ул. Автозаводская, 18',
  phone: '+7 495 000-10-10',
  resourceName: 'Бокс 1',
  canCancel: true,
  icsUrl: 'http://localhost:4173/mock/ical',
};

export async function mockApi(page: Page): Promise<void> {
  await page.route('**/mock/functions/v1/catalog', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tenant: {
          slug: 'graphite-detailing',
          name: 'GRAPHITE Detailing',
          tagline: 'Детейлинг-студия полного цикла',
          description: 'Глубокая мойка и защитные покрытия.',
          accent: '#4690ff',
          timezone: TZ,
          currency: 'RUB',
          locale: 'ru-RU',
          status: 'live',
          phone: '+7 495 000-10-10',
          address: 'Москва, ул. Автозаводская, 18',
          mapUrl: null,
          heroImageUrl: null,
          logoUrl: null,
          social: {},
          bookingLeadMinutes: 60,
          cancelWindowMinutes: 180,
          slotStepMinutes: 30,
          hoursSummary: ['Пн: 09:00–21:00'],
          infoCards: [{id: 'c1', title: 'Бокс закреплён за вами', body: 'Машина занимает бокс.', icon: 'shield'}],
        },
        services: [
          {id: 's1', name: 'Комплексная мойка', description: 'Кузов, диски, салон', priceMinor: 350000, currency: 'RUB', durationMinutes: 90, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, resourceKind: 'bay', sort: 1},
          {id: 's2', name: 'Полировка кузова', description: 'В 2 этапа', priceMinor: 1800000, currency: 'RUB', durationMinutes: 300, bufferBeforeMinutes: 30, bufferAfterMinutes: 30, resourceKind: 'station', sort: 2},
        ],
        works: [],
        serverTime: new Date().toISOString(),
      }),
    }),
  );

  await page.route('**/mock/functions/v1/availability', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        timezone: TZ,
        serviceId: 's1',
        durationMinutes: 90,
        days: [
          {date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), isClosed: false, slots: [slot(10, 0), slot(11, 30)]},
        ],
      }),
    }),
  );

  await page.route('**/mock/functions/v1/bookings', (route) => {
    const body = route.request().postDataJSON() as {action?: string};
    if (body.action === 'get' || body.action === 'cancel') {
      return route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({booking: MOCK_BOOKING})});
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({booking: MOCK_BOOKING, accessToken: 'test-access-token-1234567890', replayed: false}),
    });
  });
}
