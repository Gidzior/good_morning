import { test, expect } from '@playwright/test';

test.describe('SPA fallback', () => {
  test('deep link /account serwuje aplikacje', async ({ page }) => {
    await page.goto('/account');
    // bez sesji apka renderuje strone logowania — wazne, ze nie ma 404
    await expect(page.getByRole('link', { name: 'Zaloguj się przez Google' })).toBeVisible();
  });

  test('nieznana sciezka zwraca index.html, nie 404', async ({ request }) => {
    const res = await request.get('/taka/sciezka/nie/istnieje');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
  });
});
