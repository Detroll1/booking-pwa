import {expect, test} from '@playwright/test';
import {MOCK_BOOKING, mockApi} from './mocks';

// Full client journey in a real browser against a mocked API layer:
// choose a service -> pick a slot -> enter contacts -> confirm -> see the booking.
test('client books a service and sees the appointment', async ({page}) => {
  await mockApi(page);
  await page.goto('/s/graphite-detailing/');

  await expect(page.getByRole('heading', {name: 'GRAPHITE Detailing'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Запись в студию'})).toBeVisible();

  // Bottom navigation exists and does not hide content (page padding present).
  await expect(page.getByRole('navigation', {name: 'Основная навигация'})).toBeVisible();

  await page.getByRole('link', {name: 'Записаться'}).first().click();
  await expect(page.getByRole('heading', {name: 'Запись в студию'})).toBeVisible();

  // Step: service
  await page.getByRole('button', {name: /Комплексная мойка/}).click();

  // Step: time
  await page.getByRole('button', {name: /10:00/}).first().click();

  // Step: contacts
  await page.getByLabel('Имя').fill('Тест Клиент');
  await page.getByLabel('Телефон').fill('+7 900 111-22-33');
  await page.getByLabel('Автомобиль').fill('BMW X5');
  await page.getByRole('button', {name: /Подтвердить запись/}).click();

  // Success
  await expect(page.getByRole('heading', {name: 'Вы записаны'})).toBeVisible();
  await expect(page.getByText(MOCK_BOOKING.address)).toBeVisible();

  // Open the booking
  await page.getByRole('button', {name: 'Открыть мою запись'}).click();
  await expect(page.getByRole('heading', {name: 'Моя запись'})).toBeVisible();
  await expect(page.getByText('Комплексная мойка')).toBeVisible();
});

test('owner route requires login (no public signup)', async ({page}) => {
  await mockApi(page);
  await page.goto('/s/graphite-detailing/owner');
  await expect(page.getByRole('heading', {name: 'Вход для владельца'})).toBeVisible();
  await expect(page.getByText(/Публичной регистрации нет/)).toBeVisible();
});

test('assistant shows starter suggestions grounded in the studio', async ({page}) => {
  await mockApi(page);
  await page.route('**/mock/functions/v1/assistant', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({reply: 'Ближайшие свободные окна: завтра 10:00.', intent: 'availability', usedTools: ['get_availability'], suggestions: []}),
    }),
  );
  await page.goto('/s/graphite-detailing/');
  await page.getByRole('button', {name: 'Помощник'}).first().click();
  await page.getByRole('button', {name: 'Когда ближайшее окно?'}).click();
  await expect(page.getByText(/Ближайшие свободные окна/)).toBeVisible();
});
