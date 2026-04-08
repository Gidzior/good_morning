import 'dotenv/config';
import express from 'express';
import type { Request } from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fetch, { Response } from 'node-fetch';
import RSSParser from 'rss-parser';
import { google } from 'googleapis';
import authRouter, { requireAuth, getOAuth2ClientForUser } from './auth';
import { getCalendarPrefs, saveCalendarPrefs, getLayout, saveLayout, getUserStocks, addUserStock, deleteUserStock, getUserCryptos, addUserCrypto, deleteUserCrypto, getUserCurrencies, addUserCurrency, deleteUserCurrency, getRssWidgets, createRssWidget, updateRssWidget, deleteRssWidget, addRssFeed, deleteRssFeed, getUserCities, addUserCity, deleteUserCity, getWidgetPrefs, setWidgetEnabled, clearWidgetData } from './db';

/** Extract authenticated user ID — safe after requireAuth middleware */
function userId(req: Request): string {
  return req.user!.user_id;
}

/** Extract error message from unknown catch value */
function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

const app = express();
const PORT = 3001;
const rssParser = new RSSParser();

app.use(cookieParser());
app.use(express.json());

// --- Rate limiting ---
const authLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 10,                 // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele prob logowania. Sprobuj za minute.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  max: 300,                // 300 requests per minute (dashboard loads ~40-60 parallel requests)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zbyt wiele zapytan. Sprobuj za minute.' },
});

/** Parse JSON response, throwing on HTTP errors */
function json(r: Response): Promise<unknown> {
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`);
  return r.json();
}

interface NbpRate {
  code: string;
  currency: string;
  mid: number;
}

interface NbpTable {
  rates: NbpRate[];
}

// --- Simple in-memory cache with TTL and max size ---
interface CacheEntry<T> {
  data: T;
  expires: number;
}

const MAX_CACHE_SIZE = 200;
const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expires) {
    // Move to end for LRU ordering
    cache.delete(key);
    cache.set(key, entry);
    return Promise.resolve(entry.data);
  }
  return fetcher().then(data => {
    // Evict oldest entries if at capacity
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

const THIRTY_MIN = 30 * 60 * 1000;

interface ChartPoint { date: string; value: number }

/** Shared handler for cached history endpoints — DRY wrapper for try/cached/res.json/catch */
async function cachedHistoryHandler(
  res: express.Response,
  cacheKey: string,
  fetcher: () => Promise<ChartPoint[]>,
): Promise<void> {
  try {
    const points = await cached(cacheKey, THIRTY_MIN, fetcher);
    res.json(points);
  } catch (e: unknown) {
    console.error(`History error [${cacheKey}]:`, errMsg(e));
    res.status(502).json({ error: 'History data unavailable' });
  }
}

// Serve built React app
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// --- Auth routes (public, rate-limited) ---
app.use('/auth', authLimiter, authRouter);

// --- Protected API routes (rate-limited) ---
app.use('/api', apiLimiter, requireAuth);

// --- API: Widget preferences (enable/disable) ---
app.get('/api/widget-prefs', (req, res) => {
  res.json(getWidgetPrefs(userId(req)));
});

app.put('/api/widget-prefs/:widgetId', (req, res) => {
  const { widgetId } = req.params;
  const { enabled, deleteData, savedLayout } = req.body as {
    enabled: boolean; deleteData?: boolean; savedLayout?: Record<string, unknown>;
  };
  if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (boolean) required' });

  const restored = setWidgetEnabled(userId(req), widgetId, enabled, savedLayout);

  if (!enabled && deleteData) {
    clearWidgetData(userId(req), widgetId);
  }

  res.json({ ok: true, savedLayout: restored });
});

// --- API: Quote of the day (proxy) ---
app.get('/api/quote', async (_req, res) => {
  try {
    const r = await fetch('https://api.quotable.io/quotes/random?limit=1');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json() as { content: string; author: string }[];
    if (data?.[0]) {
      res.json({ text: data[0].content, author: data[0].author });
    } else {
      res.status(502).json({ error: 'Empty response from quote API' });
    }
  } catch (e) {
    console.error('Quote API error:', errMsg(e));
    res.status(502).json({ error: 'Quote API unavailable' });
  }
});

// --- API: User cities CRUD ---
app.get('/api/user-cities', (req, res) => {
  res.json(getUserCities(userId(req)));
});

app.post('/api/user-cities', (req, res) => {
  const { lat, lon, name, country } = req.body as { lat: number; lon: number; name: string; country: string };
  if (!name || lat == null || lon == null) return res.status(400).json({ error: 'lat, lon, name required' });
  addUserCity(userId(req), lat, lon, name, country || '');
  res.json({ ok: true });
});

app.delete('/api/user-cities', (req, res) => {
  const { lat, lon } = req.body as { lat: number; lon: number };
  if (lat == null || lon == null) return res.status(400).json({ error: 'lat and lon required' });
  deleteUserCity(userId(req), lat, lon);
  res.json({ ok: true });
});

// --- API: City search (OpenWeatherMap geocoding) ---
app.get('/api/cities/search', async (req, res) => {
  const q = req.query.q as string;
  const apiKey = process.env.WEATHER_API_KEY;
  if (!q || q.length < 2 || !apiKey) return res.json([]);
  try {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=5&appid=${apiKey}`;
    const r = await fetch(url);
    const data = await r.json() as { name: string; lat: number; lon: number; country: string; state?: string }[];
    res.json((data || []).map(c => ({
      name: c.name,
      country: c.country,
      state: c.state || '',
      lat: Math.round(c.lat * 10000) / 10000,
      lon: Math.round(c.lon * 10000) / 10000,
    })));
  } catch (e) {
    console.error('City search error:', errMsg(e));
    res.status(502).json({ error: 'City search unavailable' });
  }
});

// --- API: Weather (supports lat/lon or city name) ---
app.get('/api/weather', async (req, res) => {
  const apiKey = process.env.WEATHER_API_KEY;
  const lat = req.query.lat as string | undefined;
  const lon = req.query.lon as string | undefined;
  const city = (req.query.city as string) || process.env.WEATHER_CITY || 'Warszawa';
  const country = (req.query.country as string) || process.env.WEATHER_COUNTRY || 'PL';

  if (!apiKey || apiKey === 'TWOJ_KLUCZ_OPENWEATHERMAP') {
    return res.json({ current: { cod: 401, message: 'Brak klucza API pogody w .env' }, forecast: { list: [] } });
  }

  const locQuery = lat && lon
    ? `lat=${lat}&lon=${lon}`
    : `q=${encodeURIComponent(city)},${encodeURIComponent(country)}`;

  try {
    const [current, forecast] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?${locQuery}&appid=${apiKey}&units=metric&lang=pl`).then(json),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?${locQuery}&appid=${apiKey}&units=metric&lang=pl`).then(json),
    ]);
    res.json({ current, forecast, city: lat ? '' : city, country: lat ? '' : country });
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: BTC from Zonda ---
app.get('/api/btc', async (_req, res) => {
  try {
    const r = await fetch('https://api.zondacrypto.exchange/rest/trading/ticker/BTC-PLN');
    const data = await r.json();
    res.json(data);
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: Currencies (NBP) ---
app.get('/api/currencies', async (_req, res) => {
  try {
    const [todayRes, prevRes] = await Promise.all([
      fetch('https://api.nbp.pl/api/exchangerates/tables/A/?format=json').then(json) as Promise<NbpTable[]>,
      fetch('https://api.nbp.pl/api/exchangerates/tables/A/last/2/?format=json').then(json) as Promise<NbpTable[]>,
    ]);

    const todayRates: NbpRate[] = todayRes[0]?.rates || [];
    const prevRates: NbpRate[] = prevRes.length > 1 ? prevRes[0]?.rates || [] : [];

    const codes = ['USD', 'EUR'];
    const result = codes.map(code => {
      const today = todayRates.find(r => r.code === code);
      const prev = prevRates.find(r => r.code === code);
      return {
        currency: today?.currency || code,
        code,
        mid: today?.mid || 0,
        prev: prev?.mid || undefined,
      };
    });

    res.json(result);
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: Historical currency rates (NBP, cached 30min) ---
app.get('/api/currencies/history/:code', async (req, res) => {
  const { code } = req.params;
  const days = Math.min(Number(req.query.days) || 30, 365);
  await cachedHistoryHandler(res, `nbp-${code}-${days}`, async () => {
    const url = `https://api.nbp.pl/api/exchangerates/rates/A/${code}/last/${days}/?format=json`;
    const data = await fetch(url).then(json) as { rates: { effectiveDate: string; mid: number }[] };
    return (data.rates || []).map(r => ({ date: r.effectiveDate, value: r.mid }));
  });
});

// --- API: Historical BTC/PLN (CoinGecko, cached 30min) ---
app.get('/api/btc/history', async (_req, res) => {
  const days = Math.min(Number(_req.query.days) || 30, 365);
  await cachedHistoryHandler(res, `btc-history-${days}`, async () => {
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=pln&days=${days}`;
    const data = await fetch(url).then(json) as { prices: [number, number][] };
    const byDate = new Map<string, number>();
    for (const [ts, price] of data.prices || []) {
      byDate.set(new Date(ts).toISOString().slice(0, 10), Math.round(price * 100) / 100);
    }
    return Array.from(byDate, ([date, value]) => ({ date, value }));
  });
});

// --- API: Stocks (Yahoo Finance) ---
app.get('/api/stock/:symbol', async (req, res) => {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${req.params.symbol}?range=2d&interval=1d`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const data = await r.json();
    res.json(data);
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: Historical stock data (Yahoo Finance, cached 30min) ---
app.get('/api/stock/:symbol/history', async (req, res) => {
  const { symbol } = req.params;
  const daysParam = Math.min(Number(req.query.days) || 30, 365);
  const rangeMap: Record<number, string> = { 7: '5d', 30: '1mo', 90: '3mo', 365: '1y' };
  const range = rangeMap[daysParam] || '1mo';
  await cachedHistoryHandler(res, `stock-${symbol}-${range}`, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json() as {
      chart: {
        result: Array<{
          timestamp: number[];
          indicators: { quote: Array<{ close: (number | null)[] }> };
        }>;
      };
    };
    const result = data.chart?.result?.[0];
    if (!result?.timestamp) return [];
    const timestamps = result.timestamp;
    const closes = result.indicators?.quote?.[0]?.close || [];
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        value: closes[i] != null ? Math.round(closes[i]! * 100) / 100 : null,
      }))
      .filter((p): p is { date: string; value: number } => p.value !== null);
  });
});

// --- API: User cryptos CRUD ---
app.get('/api/user-cryptos', (req, res) => {
  res.json(getUserCryptos(userId(req)));
});
app.post('/api/user-cryptos', (req, res) => {
  const { symbol, name } = req.body as { symbol: string; name: string };
  if (!symbol || !name) return res.status(400).json({ error: 'symbol and name required' });
  addUserCrypto(userId(req), symbol, name);
  res.json({ ok: true });
});
app.delete('/api/user-cryptos/:symbol', (req, res) => {
  deleteUserCrypto(userId(req), req.params.symbol);
  res.json({ ok: true });
});

// --- API: Available Zonda PLN pairs ---
app.get('/api/cryptos/available', async (_req, res) => {
  try {
    const data = await cached('zonda-pairs', THIRTY_MIN, async () => {
      const r = await fetch('https://api.zondacrypto.exchange/rest/trading/ticker');
      const j = await r.json() as { items: Record<string, { market: { first: { currency: string }; second: { currency: string } } }> };
      return Object.entries(j.items || {})
        .filter(([k]) => k.endsWith('-PLN'))
        .map(([k, v]) => ({ symbol: k.replace('-PLN', ''), name: v.market?.first?.currency || k.replace('-PLN', '') }))
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
    });
    res.json(data);
  } catch (e) {
    console.error('Zonda pairs error:', errMsg(e));
    res.status(502).json({ error: 'Zonda API unavailable' });
  }
});

// --- API: Crypto ticker from Zonda ---
app.get('/api/crypto/:symbol', async (req, res) => {
  try {
    const r = await fetch(`https://api.zondacrypto.exchange/rest/trading/ticker/${req.params.symbol}-PLN`);
    const data = await r.json();
    res.json(data);
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: Historical crypto from CoinGecko ---
app.get('/api/crypto/:symbol/history', async (req, res) => {
  const { symbol } = req.params;
  const days = Math.min(Number(req.query.days) || 30, 365);
  const cacheKey = `crypto-${symbol}-${days}`;

  // Map common symbols to CoinGecko IDs
  const geckoMap: Record<string, string> = {
    BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', ADA: 'cardano', DOT: 'polkadot',
    DOGE: 'dogecoin', XRP: 'ripple', LINK: 'chainlink', AVAX: 'avalanche-2',
    MATIC: 'matic-network', ATOM: 'cosmos', UNI: 'uniswap', LTC: 'litecoin',
  };
  const geckoId = geckoMap[symbol.toUpperCase()] || symbol.toLowerCase();

  await cachedHistoryHandler(res, cacheKey, async () => {
    const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=pln&days=${days}`;
    const data = await fetch(url).then(json) as { prices: [number, number][] };
    const byDate = new Map<string, number>();
    for (const [ts, price] of data.prices || []) {
      byDate.set(new Date(ts).toISOString().slice(0, 10), Math.round(price * 100) / 100);
    }
    return Array.from(byDate, ([date, value]) => ({ date, value }));
  });
});

// --- API: User currencies CRUD ---
app.get('/api/user-currencies', (req, res) => {
  res.json(getUserCurrencies(userId(req)));
});
app.post('/api/user-currencies', (req, res) => {
  const { code, name } = req.body as { code: string; name: string };
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  addUserCurrency(userId(req), code, name);
  res.json({ ok: true });
});
app.delete('/api/user-currencies/:code', (req, res) => {
  deleteUserCurrency(userId(req), req.params.code);
  res.json({ ok: true });
});

// --- API: Available NBP currencies ---
app.get('/api/currencies/available', async (_req, res) => {
  try {
    const data = await cached('nbp-currencies', THIRTY_MIN, async () => {
      const r = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/?format=json');
      const j = await r.json() as { rates: { code: string; currency: string }[] }[];
      return (j[0]?.rates || []).map(r => ({ code: r.code, name: r.currency }));
    });
    res.json(data);
  } catch (e) {
    console.error('NBP currencies error:', errMsg(e));
    res.status(502).json({ error: 'NBP API unavailable' });
  }
});

// --- API: Single currency rate (NBP) ---
app.get('/api/currency/:code', async (req, res) => {
  try {
    const url = `https://api.nbp.pl/api/exchangerates/rates/A/${req.params.code}/last/2/?format=json`;
    const data = await fetch(url).then(json) as { rates: { mid: number; effectiveDate: string }[]; code: string; currency: string };
    const rates = data.rates || [];
    const current = rates[rates.length - 1];
    const prev = rates.length > 1 ? rates[rates.length - 2] : null;
    res.json({ code: data.code, currency: data.currency, mid: current?.mid || 0, prev: prev?.mid || undefined });
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: User stocks CRUD ---
app.get('/api/user-stocks', (req, res) => {
  const stocks = getUserStocks(userId(req));
  res.json(stocks);
});

app.post('/api/user-stocks', (req, res) => {
  const { symbol, name } = req.body as { symbol: string; name: string };
  if (!symbol || !name) return res.status(400).json({ error: 'symbol and name required' });
  addUserStock(userId(req), symbol, name);
  res.json({ ok: true });
});

app.delete('/api/user-stocks/:symbol', (req, res) => {
  deleteUserStock(userId(req), req.params.symbol);
  res.json({ ok: true });
});

// --- API: Stock search (Yahoo Finance) ---
app.get('/api/stocks/search', async (req, res) => {
  const q = req.query.q as string;
  if (!q || q.length < 2) return res.json([]);
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0&region=PL`;
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json() as { quotes?: { symbol: string; shortname?: string; longname?: string; exchange?: string; exchDisp?: string }[] };
    const results = (data.quotes || [])
      .filter(q => q.symbol?.endsWith('.WA'))
      .map(q => ({ symbol: q.symbol, name: q.longname || q.shortname || q.symbol }));
    res.json(results);
  } catch (e) {
    console.error('Stock search error:', errMsg(e));
    res.status(502).json({ error: 'Stock search unavailable' });
  }
});

// --- API: RSS Widgets CRUD ---
app.get('/api/rss-widgets', (req, res) => {
  res.json(getRssWidgets(userId(req)));
});

app.post('/api/rss-widgets', (req, res) => {
  const { name } = req.body as { name: string };
  if (!name) return res.status(400).json({ error: 'name required' });
  const widget = createRssWidget(userId(req), name);
  res.json(widget);
});

app.put('/api/rss-widgets/:id', (req, res) => {
  const { name } = req.body as { name: string };
  if (!name) return res.status(400).json({ error: 'name required' });
  updateRssWidget(userId(req), req.params.id, name);
  res.json({ ok: true });
});

app.delete('/api/rss-widgets/:id', (req, res) => {
  deleteRssWidget(userId(req), req.params.id);
  res.json({ ok: true });
});

app.post('/api/rss-widgets/:id/feeds', (req, res) => {
  const { url: rawUrl, name, articles_count } = req.body as { url: string; name: string; articles_count?: number };
  const url = rawUrl?.trim();
  if (!url || !name) return res.status(400).json({ error: 'url and name required' });
  const count = Math.max(1, Math.min(10, Number(articles_count) || 3));
  try {
    const feed = addRssFeed(userId(req), req.params.id, url, name, count);
    res.json(feed);
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/rss-widgets/:widgetId/feeds/:feedId', (req, res) => {
  try {
    deleteRssFeed(userId(req), req.params.widgetId, req.params.feedId);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(403).json({ error: errMsg(e) });
  }
});

// --- API: RSS proxy (with SSRF protection) ---
app.get('/api/rss', async (req, res) => {
  const url = req.query.url as string | undefined;
  if (!url) return res.status(400).json({ error: 'url required' });

  // Only allow http/https, block private/internal URLs
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs allowed' });
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname.startsWith('10.')
        || hostname.startsWith('192.168.') || hostname.startsWith('172.') || hostname === '0.0.0.0'
        || hostname.endsWith('.local') || hostname === '169.254.169.254' || hostname === '[::1]') {
      return res.status(400).json({ error: 'Internal URLs not allowed' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  try {
    const feed = await rssParser.parseURL(url);
    res.json(feed);
  } catch (e: unknown) {
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: List user's Google Calendars ---
app.get('/api/calendars', async (req, res) => {
  const uid = userId(req);

  const oauth2Client = getOAuth2ClientForUser(uid);
  if (!oauth2Client) {
    return res.json({ calendars: [], prefs: [] });
  }

  try {
    const cal = google.calendar({ version: 'v3', auth: oauth2Client });
    const response = await cal.calendarList.list();
    const calendars = (response.data.items || []).map(c => ({
      id: c.id || '',
      summary: c.summary || '',
      primary: c.primary || false,
      backgroundColor: c.backgroundColor || '#4285f4',
    }));

    const prefs = getCalendarPrefs(uid);
    res.json({ calendars, prefs });
  } catch (e: unknown) {
    console.error('Calendar list error:', e);
    const msg = errMsg(e);
    res.status(500).json({ error: msg });
  }
});

// --- API: Save calendar preferences ---
app.post('/api/calendars/prefs', async (req, res) => {
  const uid = userId(req);
  const { prefs } = req.body as { prefs: { calendar_id: string; calendar_name: string; enabled: boolean }[] };

  if (!Array.isArray(prefs)) {
    return res.status(400).json({ error: 'Nieprawidlowe dane' });
  }

  saveCalendarPrefs(uid, prefs);
  res.json({ ok: true });
});

// --- API: Google Calendar events (per-user, multi-calendar) ---
app.get('/api/calendar', async (req, res) => {
  const uid = userId(req);
  const { timeMin, timeMax } = req.query;

  const oauth2Client = getOAuth2ClientForUser(uid);
  if (!oauth2Client) {
    return res.json({ error: 'Kalendarz nie polaczony. Przejdz do ustawien konta.' });
  }

  try {
    const cal = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get enabled calendars from prefs, default to primary only
    const prefs = getCalendarPrefs(uid);
    const enabledIds = prefs.length > 0
      ? prefs.filter(p => p.enabled).map(p => p.calendar_id)
      : ['primary'];

    // Get calendar colors
    const calList = await cal.calendarList.list();
    const colorMap = new Map<string, string>();
    for (const c of calList.data.items || []) {
      if (c.id) colorMap.set(c.id, c.backgroundColor || '#4285f4');
    }

    // Fetch events from all enabled calendars in parallel
    const allEvents = await Promise.all(
      enabledIds.map(async (calendarId) => {
        try {
          const response = await cal.events.list({
            calendarId,
            timeMin: timeMin as string,
            timeMax: timeMax as string,
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 30,
          });
          const color = colorMap.get(calendarId) || '#4285f4';
          return (response.data.items || []).map(ev => ({ ...ev, calendarColor: color }));
        } catch (e) {
          console.error(`Calendar ${calendarId} fetch error:`, errMsg(e));
          return [];
        }
      })
    );

    // Merge and sort by start time
    const merged = allEvents.flat().sort((a, b) => {
      const aStart = a.start?.dateTime || a.start?.date || '';
      const bStart = b.start?.dateTime || b.start?.date || '';
      return aStart.localeCompare(bStart);
    });

    res.json({ items: merged });
  } catch (e: unknown) {
    console.error('Calendar API error:', e);
    const msg = errMsg(e);
    res.json({ error: `Blad kalendarza: ${msg}` });
  }
});

// --- API: Dashboard layout ---
app.get('/api/layout', (req, res) => {
  const uid = userId(req);
  const layout = getLayout(uid);
  res.json({ layout });
});

app.put('/api/layout', (req, res) => {
  const uid = userId(req);
  const { layout } = req.body as { layout: unknown };
  if (!layout) {
    return res.status(400).json({ error: 'Brak danych layoutu' });
  }
  saveLayout(uid, layout);
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
});
