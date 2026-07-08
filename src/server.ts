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
import { getCalendarPrefs, saveCalendarPrefs, getLayout, saveLayout, getUserStocks, addUserStock, deleteUserStock, getUserCryptos, addUserCrypto, deleteUserCrypto, getUserCurrencies, addUserCurrency, deleteUserCurrency, getRssWidgets, createRssWidget, updateRssWidget, deleteRssWidget, addRssFeed, deleteRssFeed, getUserCities, addUserCity, deleteUserCity, getWidgetPrefs, setWidgetEnabled, clearWidgetData, getTodoLists, createTodoList, updateTodoList, deleteTodoList } from './db';

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
const FIVE_MIN = 5 * 60 * 1000;

interface ChartPoint { date: string; value: number }

// --- USD/PLN helpers (NBP) ---
async function getUsdPlnRate(): Promise<number> {
  return cached('nbp-usd-pln-current', FIVE_MIN, async () => {
    const r = await fetch('https://api.nbp.pl/api/exchangerates/rates/A/USD/?format=json');
    if (!r.ok) throw new Error(`NBP HTTP ${r.status}`);
    const j = await r.json() as { rates: { mid: number }[] };
    const mid = j.rates?.[0]?.mid;
    if (!mid) throw new Error('NBP USD/PLN unavailable');
    return mid;
  });
}

/** Returns map of date (YYYY-MM-DD) → USD/PLN mid rate for last N days, plus latest rate as fallback. */
async function getUsdPlnSeries(days: number): Promise<{ byDate: Map<string, number>; latest: number }> {
  const cacheKey = `nbp-usd-pln-series-${days}`;
  return cached(cacheKey, THIRTY_MIN, async () => {
    const url = `https://api.nbp.pl/api/exchangerates/rates/A/USD/last/${Math.min(days + 10, 367)}/?format=json`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`NBP HTTP ${r.status}`);
    const j = await r.json() as { rates: { effectiveDate: string; mid: number }[] };
    const rates = j.rates || [];
    const byDate = new Map<string, number>();
    for (const e of rates) byDate.set(e.effectiveDate, e.mid);
    const latest = rates[rates.length - 1]?.mid;
    if (!latest) throw new Error('NBP USD/PLN series empty');
    return { byDate, latest };
  });
}

/** Look up USD/PLN rate for a date, walking back up to 7 days for weekends/holidays. */
function rateForDate(series: { byDate: Map<string, number>; latest: number }, date: string): number {
  const direct = series.byDate.get(date);
  if (direct) return direct;
  const d = new Date(date);
  for (let i = 1; i <= 7; i++) {
    d.setDate(d.getDate() - 1);
    const key = d.toISOString().slice(0, 10);
    const v = series.byDate.get(key);
    if (v) return v;
  }
  return series.latest;
}

/** Shared handler for cached proxy endpoints — try/cached/res.json/catch with per-endpoint error message */
async function cachedJsonHandler<T>(
  res: express.Response,
  cacheKey: string,
  ttl: number,
  errorMessage: string,
  fetcher: () => Promise<T>,
): Promise<void> {
  try {
    res.json(await cached(cacheKey, ttl, fetcher));
  } catch (e: unknown) {
    console.error(`Fetch error [${cacheKey}]:`, errMsg(e));
    res.status(502).json({ error: errorMessage });
  }
}

/**
 * Rejestruje GET/POST/DELETE dla per-user listy (cities/cryptos/currencies/stocks).
 * Walidacja i wywolania db.ts zostaja per-domena w closurach add/remove;
 * add/remove zwracaja { error } (→ 400) albo null (→ { ok: true }).
 */
function registerUserListCrud(opts: {
  path: string;                                                                   // np. '/api/user-cryptos'
  list: (uid: string) => unknown;
  add: (uid: string, body: Record<string, unknown>) => { error: string } | null;  // walidacja + insert; null = OK
  removeRoute: string;                                                            // np. '/api/user-cryptos/:symbol' LUB path (cities: body)
  remove: (uid: string, req: Request) => { error: string } | null;
}): void {
  app.get(opts.path, (req, res) => {
    res.json(opts.list(userId(req)));
  });
  app.post(opts.path, (req, res) => {
    const err = opts.add(userId(req), req.body as Record<string, unknown>);
    if (err) return res.status(400).json(err);
    res.json({ ok: true });
  });
  app.delete(opts.removeRoute, (req, res) => {
    const err = opts.remove(userId(req), req);
    if (err) return res.status(400).json(err);
    res.json({ ok: true });
  });
}

type ResolvedTasklist = { tasks: ReturnType<typeof google.tasks>; tasklistId: string };

/**
 * Wspolna preambula mutacji Google Tasks: lookup listy + oauth + klient.
 * Pisze 4xx do res i zwraca null gdy brak listy lub tokenow.
 */
function resolveTasklist(req: Request, res: express.Response): ResolvedTasklist | null {
  const lists = getTodoLists(userId(req));
  const list = lists.find(l => l.id === req.params.id);
  if (!list?.google_tasklist_id) {
    res.status(400).json({ error: 'List not linked to Google Tasks' });
    return null;
  }
  const oauth2Client = getOAuth2ClientForUser(userId(req));
  if (!oauth2Client) {
    res.status(403).json({ error: 'Google not connected' });
    return null;
  }
  return { tasks: google.tasks({ version: 'v1', auth: oauth2Client }), tasklistId: list.google_tasklist_id };
}

/** Wspolny catch mutacji Google Tasks — log + 502 */
function taskError(res: express.Response, label: string, e: unknown): void {
  console.error(`${label}:`, errMsg(e));
  res.status(502).json({ error: `Blad Google Tasks: ${errMsg(e)}` });
}

type CalendarInfo = { id: string; summary: string; primary: boolean; backgroundColor: string };

/** Pobiera liste kalendarzy uzytkownika — wspolne dla /api/calendars i /api/calendar */
async function fetchCalendarList(auth: NonNullable<ReturnType<typeof getOAuth2ClientForUser>>): Promise<CalendarInfo[]> {
  const cal = google.calendar({ version: 'v3', auth });
  const response = await cal.calendarList.list();
  return (response.data.items || []).map(c => ({
    id: c.id || '',
    summary: c.summary || '',
    primary: c.primary || false,
    backgroundColor: c.backgroundColor || '#4285f4',
  }));
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
registerUserListCrud({
  path: '/api/user-cities',
  list: getUserCities,
  add: (uid, body) => {
    const { lat, lon, name, country } = body as { lat: number; lon: number; name: string; country: string };
    if (!name || lat == null || lon == null) return { error: 'lat, lon, name required' };
    addUserCity(uid, lat, lon, name, country || '');
    return null;
  },
  removeRoute: '/api/user-cities',
  remove: (uid, req) => {
    const { lat, lon } = req.body as { lat: number; lon: number };
    if (lat == null || lon == null) return { error: 'lat and lon required' };
    deleteUserCity(uid, lat, lon);
    return null;
  },
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
  await cachedJsonHandler<ChartPoint[]>(res, `nbp-${code}-${days}`, THIRTY_MIN, 'History data unavailable', async () => {
    const url = `https://api.nbp.pl/api/exchangerates/rates/A/${code}/last/${days}/?format=json`;
    const data = await fetch(url).then(json) as { rates: { effectiveDate: string; mid: number }[] };
    return (data.rates || []).map(r => ({ date: r.effectiveDate, value: r.mid }));
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
  await cachedJsonHandler<ChartPoint[]>(res, `stock-${symbol}-${range}`, THIRTY_MIN, 'History data unavailable', async () => {
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
registerUserListCrud({
  path: '/api/user-cryptos',
  list: getUserCryptos,
  add: (uid, body) => {
    const { symbol, name } = body as { symbol: string; name: string };
    if (!symbol || !name) return { error: 'symbol and name required' };
    addUserCrypto(uid, symbol, name);
    return null;
  },
  removeRoute: '/api/user-cryptos/:symbol',
  remove: (uid, req) => {
    deleteUserCrypto(uid, req.params.symbol as string);
    return null;
  },
});

// --- API: Available Binance USDT spot pairs ---
app.get('/api/cryptos/available', async (_req, res) => {
  await cachedJsonHandler(res, 'binance-usdt-pairs', THIRTY_MIN, 'Binance API unavailable', async () => {
    const r = await fetch('https://api.binance.com/api/v3/exchangeInfo');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json() as { symbols: { symbol: string; baseAsset: string; quoteAsset: string; status: string; isSpotTradingAllowed: boolean }[] };
    return (j.symbols || [])
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING' && s.isSpotTradingAllowed)
      .map(s => ({ symbol: s.baseAsset, name: s.baseAsset }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
  });
});

// --- API: Crypto ticker from Binance (USDT) converted to PLN via NBP ---
app.get('/api/crypto/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const [t, usd] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}USDT`).then(json) as Promise<{ lastPrice: string; openPrice: string }>,
      getUsdPlnRate(),
    ]);
    const rate = parseFloat(t.lastPrice) * usd;
    const previousRate = parseFloat(t.openPrice) * usd;
    res.json({
      ticker: {
        market: { code: `${symbol}-PLN`, first: { currency: symbol }, second: { currency: 'PLN' } },
        rate: rate.toFixed(2),
        previousRate: previousRate.toFixed(2),
        time: Date.now(),
      },
    });
  } catch (e: unknown) {
    console.error('Binance ticker error:', errMsg(e));
    res.status(502).json({ error: 'Binance API unavailable' });
  }
});

// --- API: Historical crypto from Binance klines + NBP, cached 30min ---
app.get('/api/crypto/:symbol/history', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const days = Math.min(Number(req.query.days) || 30, 365);
  await cachedJsonHandler<ChartPoint[]>(res, `crypto-${symbol}-${days}`, THIRTY_MIN, 'History data unavailable', async () => {
    const [klines, series] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=${days}`).then(json) as Promise<[number, string, string, string, string][]>,
      getUsdPlnSeries(days),
    ]);
    return (klines || []).map(k => {
      const date = new Date(k[0]).toISOString().slice(0, 10);
      const close = parseFloat(k[4]);
      const rate = rateForDate(series, date);
      return { date, value: Math.round(close * rate * 100) / 100 };
    });
  });
});

// --- API: User currencies CRUD ---
registerUserListCrud({
  path: '/api/user-currencies',
  list: getUserCurrencies,
  add: (uid, body) => {
    const { code, name } = body as { code: string; name: string };
    if (!code || !name) return { error: 'code and name required' };
    addUserCurrency(uid, code, name);
    return null;
  },
  removeRoute: '/api/user-currencies/:code',
  remove: (uid, req) => {
    deleteUserCurrency(uid, req.params.code as string);
    return null;
  },
});

// --- API: Available NBP currencies ---
app.get('/api/currencies/available', async (_req, res) => {
  await cachedJsonHandler(res, 'nbp-currencies', THIRTY_MIN, 'NBP API unavailable', async () => {
    const r = await fetch('https://api.nbp.pl/api/exchangerates/tables/A/?format=json');
    const j = await r.json() as { rates: { code: string; currency: string }[] }[];
    return (j[0]?.rates || []).map(r => ({ code: r.code, name: r.currency }));
  });
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
registerUserListCrud({
  path: '/api/user-stocks',
  list: getUserStocks,
  add: (uid, body) => {
    const { symbol, name } = body as { symbol: string; name: string };
    if (!symbol || !name) return { error: 'symbol and name required' };
    addUserStock(uid, symbol, name);
    return null;
  },
  removeRoute: '/api/user-stocks/:symbol',
  remove: (uid, req) => {
    deleteUserStock(uid, req.params.symbol as string);
    return null;
  },
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
    return res.status(403).json({ error: 'Kalendarz nie polaczony. Przejdz do ustawien konta.' });
  }

  try {
    const calendars = await fetchCalendarList(oauth2Client);
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
    return res.status(403).json({ error: 'Kalendarz nie polaczony. Przejdz do ustawien konta.' });
  }

  try {
    const cal = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get enabled calendars from prefs, default to primary only
    const prefs = getCalendarPrefs(uid);
    const enabledIds = prefs.length > 0
      ? prefs.filter(p => p.enabled).map(p => p.calendar_id)
      : ['primary'];

    // Get calendar colors
    const calList = await fetchCalendarList(oauth2Client);
    const colorMap = new Map<string, string>(calList.map(c => [c.id, c.backgroundColor]));

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
    res.status(502).json({ error: `Blad kalendarza: ${msg}` });
  }
});

// --- API: Todo Lists CRUD ---
app.get('/api/todo-lists', (req, res) => {
  res.json(getTodoLists(userId(req)));
});

app.post('/api/todo-lists', async (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  // Try to create a Google Task List, fall back to null if not connected
  let googleTasklistId: string | null = null;
  const oauth2Client = getOAuth2ClientForUser(userId(req));
  if (oauth2Client) {
    try {
      const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });
      const response = await tasksApi.tasklists.insert({ requestBody: { title: name.trim() } });
      googleTasklistId = response.data.id || null;
    } catch (e) {
      console.error('Failed to create Google Task List:', errMsg(e));
    }
  }

  const list = createTodoList(userId(req), name.trim(), googleTasklistId);
  res.json(list);
});

app.put('/api/todo-lists/:id', (req, res) => {
  const { name } = req.body as { name: string };
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  updateTodoList(userId(req), req.params.id, name.trim());
  res.json({ ok: true });
});

app.delete('/api/todo-lists/:id', async (req, res) => {
  const lists = getTodoLists(userId(req));
  const list = lists.find(l => l.id === req.params.id);
  if (list?.google_tasklist_id) {
    const oauth2Client = getOAuth2ClientForUser(userId(req));
    if (oauth2Client) {
      try {
        const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });
        await tasksApi.tasklists.delete({ tasklist: list.google_tasklist_id });
      } catch (e) {
        console.error('Failed to delete Google Task List:', errMsg(e));
      }
    }
  }
  deleteTodoList(userId(req), req.params.id);
  res.json({ ok: true });
});

// --- API: Tasks within a todo list ---
app.get('/api/todo-lists/:id/tasks', async (req, res) => {
  const lists = getTodoLists(userId(req));
  const list = lists.find(l => l.id === req.params.id);
  if (!list) return res.status(404).json({ error: 'List not found' });
  if (!list.google_tasklist_id) return res.json({ items: [], error: 'Brak polaczenia z Google Tasks' });

  const oauth2Client = getOAuth2ClientForUser(userId(req));
  if (!oauth2Client) return res.json({ items: [], error: 'Polacz konto Google w ustawieniach.' });

  try {
    const tasksApi = google.tasks({ version: 'v1', auth: oauth2Client });
    const response = await tasksApi.tasks.list({
      tasklist: list.google_tasklist_id,
      maxResults: 100,
      showCompleted: true,
      showHidden: false,
    });
    const items = response.data.items || [];
    items.sort((a, b) => (a.position || '').localeCompare(b.position || ''));
    res.json({ items });
  } catch (e: unknown) {
    const msg = errMsg(e);
    console.error('Tasks API error:', msg);
    if (msg.includes('insufficient authentication scopes') || msg.includes('has not been used in project')) {
      return res.json({ items: [], error: 'Wlacz Google Tasks API i zaloguj sie ponownie.' });
    }
    res.status(500).json({ error: msg });
  }
});

app.post('/api/todo-lists/:id/tasks', async (req, res) => {
  const { title } = req.body as { title: string };
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  const ctx = resolveTasklist(req, res);
  if (!ctx) return;

  try {
    const response = await ctx.tasks.tasks.insert({
      tasklist: ctx.tasklistId,
      requestBody: { title: title.trim(), status: 'needsAction' },
    });
    res.json(response.data);
  } catch (e: unknown) {
    taskError(res, 'Tasks create error', e);
  }
});

app.patch('/api/todo-lists/:id/tasks/:taskId', async (req, res) => {
  const { status } = req.body as { status: 'needsAction' | 'completed' };
  if (!status || !['needsAction', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'status must be needsAction or completed' });
  }
  const ctx = resolveTasklist(req, res);
  if (!ctx) return;

  try {
    const response = await ctx.tasks.tasks.patch({
      tasklist: ctx.tasklistId,
      task: req.params.taskId,
      requestBody: {
        status,
        completed: status === 'completed' ? new Date().toISOString() : null,
      },
    });
    res.json(response.data);
  } catch (e: unknown) {
    taskError(res, 'Tasks update error', e);
  }
});

app.post('/api/todo-lists/:id/tasks/:taskId/move', async (req, res) => {
  const { previousTaskId } = req.body as { previousTaskId: string | null };
  const ctx = resolveTasklist(req, res);
  if (!ctx) return;

  try {
    const response = await ctx.tasks.tasks.move({
      tasklist: ctx.tasklistId,
      task: req.params.taskId,
      previous: previousTaskId || undefined,
    });
    res.json(response.data);
  } catch (e: unknown) {
    taskError(res, 'Tasks move error', e);
  }
});

app.delete('/api/todo-lists/:id/tasks/:taskId', async (req, res) => {
  const ctx = resolveTasklist(req, res);
  if (!ctx) return;

  try {
    await ctx.tasks.tasks.delete({ tasklist: ctx.tasklistId, task: req.params.taskId });
    res.json({ ok: true });
  } catch (e: unknown) {
    taskError(res, 'Tasks delete error', e);
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
