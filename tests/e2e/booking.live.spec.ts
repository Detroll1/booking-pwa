import {expect, test} from '@playwright/test';

// Real end-to-end run against a deployed/live backend. Enabled only with
// E2E_LIVE=1 and E2E_BASE_URL=http://your-site plus a tenant that is `live`.
const live = process.env.E2E_LIVE === '1';
const slug = process.env.E2E_TENANT ?? 'graphite-detailing';

test.describe('live booking flow', () => {
  test.skip(!live, 'Set E2E_LIVE=1 and E2E_BASE_URL to run against a real backend.');

  test('books, then the owner sees the booking', async ({page}) => {
    await page.goto(`/s/${slug}/`);
    await expect(page.getByRole('heading', {name: 'Запись в студию'})).toBeVisible();
    await page.getByRole('link', {name: 'Записаться'}).first().click();
    await page.getByRole('button').filter({hasText: /мин/}).first().click();
    await page.getByRole('button').filter({hasText: /\d{1,2}:\d{2}/}).first().click();
    await page.getByLabel('Имя').fill('E2E Клиент');
    await page.getByLabel('Телефон').fill('+7 999 000-00-00');
    await page.getByRole('button', {name: /Подтвердить запись/}).click();
    await expect(page.getByRole('heading', {name: 'Вы записаны'})).toBeVisible();

    // Owner cabinet: sign in with provided credentials and see the booking.
    const email = process.env.E2E_OWNER_EMAIL;
    const password = process.env.E2E_OWNER_PASSWORD;
    test.skip(!email || !password, 'Owner credentials are required for the owner leg.');
    await page.goto(`/s/${slug}/owner/login`);
    await page.getByLabel('Почта').fill(email!);
    await page.getByLabel('Пароль').fill(password!);
    await page.getByRole('button', {name: /Войти/}).click();
    await expect(page.getByText('E2E Клиент')).toBeVisible();
  });
});
