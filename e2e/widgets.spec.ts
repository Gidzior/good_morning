import { test, expect } from '@playwright/test';
import { devLogin } from './helpers';

test.describe('widgety (struktura, nie dane)', () => {
  test('zmiana okresu wykresu krypto nie wywala widgetu', async ({ page }) => {
    await devLogin(page);
    const crypto = page.locator('[data-slot="card"]').filter({ hasText: 'Kryptowaluty' }).first();
    await expect(crypto).toBeVisible();

    // przyciski okresow renderuja sie, bo seed dodaje BTC do listy usera;
    // ceny/wykres moga byc bledem (zewnetrzne API) — widget ma zyc mimo to
    const btn1M = crypto.getByRole('button', { name: '1M', exact: true });
    await expect(btn1M).toBeVisible({ timeout: 20_000 });
    await btn1M.click();

    await expect(crypto.getByText('Kryptowaluty', { exact: true })).toBeVisible();
    await expect(crypto.getByRole('button', { name: '7D', exact: true })).toBeVisible();
  });

  test('dodanie i usuniecie widgetu RSS', async ({ page }) => {
    // unikalna nazwa — CI ma retries: 1 na wspolnej bazie, osierocony widget
    // z failniętego attemptu nie moze kolidowac z powtorka
    const widgetName = `E2E RSS ${Date.now()}`;
    await devLogin(page);
    await page.getByRole('button', { name: 'Dodaj kanał RSS' }).click();
    await page.getByPlaceholder('Nazwa widgetu').fill(widgetName);
    await page.getByRole('button', { name: 'Dodaj', exact: true }).click();

    const card = page.locator('[data-slot="card"]').filter({ hasText: widgetName }).first();
    await expect(card).toBeVisible();

    // usuniecie przez API (UI kasowania to flow "wylacz widget" — poza zakresem)
    const listRes = await page.request.get('/api/rss-widgets');
    const widgets = (await listRes.json()) as { id: string; name: string }[];
    const created = widgets.find(w => w.name === widgetName);
    if (!created) throw new Error(`Widget "${widgetName}" nie istnieje w /api/rss-widgets po dodaniu`);

    const del = await page.request.delete(`/api/rss-widgets/${created.id}`);
    expect(del.ok()).toBeTruthy();

    await page.reload();
    await expect(page.getByText('Pogoda', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-slot="card"]').filter({ hasText: widgetName })).toHaveCount(0);
  });
});
