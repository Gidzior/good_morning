import { test, expect } from '@playwright/test';
import { apiLogin } from './helpers';

test.describe('API (request-level)', () => {
  test('layout: PUT -> GET round-trip', async ({ request }) => {
    await apiLogin(request);
    const layout = {
      lg: [{ i: 'weather', x: 0, y: 0, w: 6, h: 4 }],
      md: [{ i: 'weather', x: 0, y: 0, w: 6, h: 4 }],
      sm: [{ i: 'weather', x: 0, y: 0, w: 2, h: 4 }],
    };
    const put = await request.put('/api/layout', { data: { layout } });
    expect(put.ok()).toBeTruthy();

    const got = await request.get('/api/layout');
    expect(got.ok()).toBeTruthy();
    const body = (await got.json()) as { layout: unknown };
    expect(body.layout).toEqual(layout);
  });

  test('PUT layout bez body zwraca 400, nie 500', async ({ request }) => {
    // regresja express 5: req.body undefined bez JSON body — middleware przywraca {}
    await apiLogin(request);
    const res = await request.put('/api/layout');
    expect(res.status()).toBe(400);
  });

  test('POST rss-widgets bez body zwraca 400 z komunikatem', async ({ request }) => {
    await apiLogin(request);
    const res = await request.post('/api/rss-widgets');
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });
});
