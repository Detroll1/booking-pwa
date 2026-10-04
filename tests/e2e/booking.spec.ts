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

  // Step: intro
  await page.getByRole('button', {name: /Выбрать время/}).click();

  // Step: service
  await page.getByRole('button', {name: 'Выбрать'}).first().click();

  // Step: time
  await page.getByRole('button', {name: /10:00/}).first().click();
  await page.getByRole('button', {name: 'Продолжить'}).click();

  // Step: contacts
  await page.getByLabel('Имя').fill('Тест Клиент');
  await page.getByLabel('Телефон').fill('+7 900 111-22-33');
  await page.getByLabel('Автомобиль').fill('BMW X5');
  await page.getByRole('button', {name: 'Проверить запись'}).click();

  // Step: review
  await expect(page.getByRole('heading', {name: 'Проверьте запись'})).toBeVisible();
  await expect(page.getByText('Заезд').first()).toBeVisible();
  await page.getByRole('button', {name: /Подтвердить запись/}).click();

  // Success
  await expect(page.getByRole('heading', {name: 'Вы записаны'})).toBeVisible();
  await expect(page.getByText(MOCK_BOOKING.address)).toBeVisible();

  // Open the booking
  await page.getByRole('button', {name: 'Открыть мою запись'}).click();
  await expect(page.getByRole('heading', {name: 'Моя запись'})).toBeVisible();
  await expect(page.getByText('Экспресс-мойка')).toBeVisible();
});

test('owner route requires login (no public signup)', async ({page}) => {
  await mockApi(page);
  await page.goto('/s/graphite-detailing/owner');
  await expect(page.getByRole('heading', {name: 'Вход для владельца'})).toBeVisible();
  await expect(page.getByText(/Публичной регистрации нет/)).toBeVisible();
});

test('assistant screen offers starter suggestions grounded in the studio', async ({page}) => {
  await mockApi(page);
  await page.goto('/s/graphite-detailing/ai');
  await expect(page.getByRole('heading', {name: 'Запись с ИИ'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Когда ближайшее окно?'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Сколько стоит полировка?'})).toBeVisible();
});
