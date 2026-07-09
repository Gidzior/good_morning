import { test, expect } from '@playwright/test';
import { devLogin } from './helpers';

test.describe('autoryzacja', () => {
  test('API bez sesji zwraca 401', async ({ request }) => {
    const res = await request.get('/api/layout');
    expect(res.status()).toBe(401);
  });

  test('niezalogowany widzi strone logowania', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Zaloguj się przez Google' })).toBeVisible();
  });

  test('dev-login otwiera dashboard z widgetami', async ({ page }) => {
    await devLogin(page);
    // struktura, nie dane — karty widgetow renderuja sie nawet gdy zewnetrzne API padnie
    for (const title of ['Kryptowaluty', 'Waluty', 'Akcje']) {
      await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
    }
  });
});
