import { expect } from '@playwright/test';
import type { Page, APIRequestContext } from '@playwright/test';

// Logowanie w przegladarce: /auth/dev-login tworzy sesje dla usera z seedu
// i przekierowuje na dashboard. Czekamy na karte pogody = shell zaladowany.
export async function devLogin(page: Page): Promise<void> {
  await page.goto('/auth/dev-login');
  await expect(page.getByText('Pogoda', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

// Logowanie bez przegladarki — cookie sesji laduje w kontekscie requestow API
export async function apiLogin(request: APIRequestContext): Promise<void> {
  const res = await request.get('/auth/dev-login');
  expect(res.ok()).toBeTruthy();
}
