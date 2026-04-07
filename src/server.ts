import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import fetch, { Response } from 'node-fetch';
import RSSParser from 'rss-parser';
import { google } from 'googleapis';
import authRouter, { requireAuth, getOAuth2ClientForUser } from './auth';
import { getCalendarPrefs, saveCalendarPrefs, getLayout, saveLayout, getUserStocks, addUserStock, deleteUserStock, getUserCryptos, addUserCrypto, deleteUserCrypto, getUserCurrencies, addUserCurrency, deleteUserCurrency, getRssWidgets, createRssWidget, updateRssWidget, deleteRssWidget, addRssFeed, deleteRssFeed } from './db';

const app = express();
const PORT = 3001;
const rssParser = new RSSParser();

app.use(cookieParser());
app.use(express.json());

const json = (r: Response) => r.json();

interface NbpRate {
  code: string;
  currency: string;
  mid: number;
}

interface NbpTable {
  rates: NbpRate[];
}

// --- Simple in-memory cache with TTL ---
interface CacheEntry<T> {
  data: T;
  expires: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (entry && Date.now() < entry.expires) return Promise.resolve(entry.data);
  return fetcher().then(data => {
    cache.set(key, { data, expires: Date.now() + ttlMs });
    return data;
  });
}

const THIRTY_MIN = 30 * 60 * 1000;

// Serve built React app
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// --- Auth routes (public) ---
app.use('/auth', authRouter);

// --- Protected API routes ---
app.use('/api', requireAuth);

// --- API: Weather (keys from .env) ---
app.get('/api/weather', async (req, res) => {
  const apiKey = process.env.WEATHER_API_KEY;
  const city = (req.query.city as string) || process.env.WEATHER_CITY || 'Warszawa';
  const country = (req.query.country as string) || process.env.WEATHER_COUNTRY || 'PL';

  if (!apiKey || apiKey === 'TWOJ_KLUCZ_OPENWEATHERMAP') {
    return res.json({ current: { cod: 401, message: 'Brak klucza API pogody w .env' }, forecast: { list: [] } });
  }

  try {
    const [current, forecast] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},${encodeURIComponent(country)}&appid=${apiKey}&units=metric&lang=pl`).then(json),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},${encodeURIComponent(country)}&appid=${apiKey}&units=metric&lang=pl`).then(json),
    ]);
    res.json({ current, forecast, city, country });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
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
    const msg = e instanceof Error ? e.message : 'Unknown error';
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
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// --- API: Historical currency rates (NBP, cached 30min) ---
app.get('/api/currencies/history/:code', async (req, res) => {
  const { code } = req.params;
  const days = Math.min(Number(req.query.days) || 30, 365);
  const cacheKey = `nbp-${code}-${days}`;

  try {
    const points = await cached(cacheKey, THIRTY_MIN, async () => {
      const url = `https://api.nbp.pl/api/exchangerates/rates/A/${code}/last/${days}/?format=json`;
      const data = await fetch(url).then(json) as { rates: { effectiveDate: string; mid: number }[] };
      return (data.rates || []).map(r => ({
        date: r.effectiveDate,
        value: r.mid,
      }));
    });
    res.json(points);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// --- API: Historical BTC/PLN (CoinGecko, cached 30min) ---
app.get('/api/btc/history', async (_req, res) => {
  const days = Math.min(Number(_req.query.days) || 30, 365);
  const cacheKey = `btc-history-${days}`;

  try {
    const result = await cached(cacheKey, THIRTY_MIN, async () => {
      const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=pln&days=${days}`;
      const data = await fetch(url).then(json) as { prices: [number, number][] };
      const points = (data.prices || []).map(([ts, price]) => ({
        date: new Date(ts).toISOString().slice(0, 10),
        value: Math.round(price * 100) / 100,
      }));
      // Deduplicate by date (keep last entry per day)
      const byDate = new Map<string, number>();
      for (const p of points) byDate.set(p.date, p.value);
      return Array.from(byDate, ([date, value]) => ({ date, value }));
    });
    res.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
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
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// --- API: Historical stock data (Yahoo Finance, cached 30min) ---
app.get('/api/stock/:symbol/history', async (req, res) => {
  const { symbol } = req.params;
  const daysParam = Math.min(Number(req.query.days) || 30, 365);
  const rangeMap: Record<number, string> = { 7: '5d', 30: '1mo', 90: '3mo', 365: '1y' };
  const range = rangeMap[daysParam] || '1mo';
  const cacheKey = `stock-${symbol}-${range}`;

  try {
    const points = await cached(cacheKey, THIRTY_MIN, async () => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
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
    res.json(points);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// --- API: User cryptos CRUD ---
app.get('/api/user-cryptos', (req, res) => {
  res.json(getUserCryptos(req.user!.user_id));
});
app.post('/api/user-cryptos', (req, res) => {
  const { symbol, name } = req.body as { symbol: string; name: string };
  if (!symbol || !name) return res.status(400).json({ error: 'symbol and name required' });
  addUserCrypto(req.user!.user_id, symbol, name);
  res.json({ ok: true });
});
app.delete('/api/user-cryptos/:symbol', (req, res) => {
  deleteUserCrypto(req.user!.user_id, req.params.symbol);
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
  } catch {
    res.json([]);
  }
});

// --- API: Crypto ticker from Zonda ---
app.get('/api/crypto/:symbol', async (req, res) => {
  try {
    const r = await fetch(`https://api.zondacrypto.exchange/rest/trading/ticker/${req.params.symbol}-PLN`);
    const data = await r.json();
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
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

  try {
    const result = await cached(cacheKey, THIRTY_MIN, async () => {
      const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/market_chart?vs_currency=pln&days=${days}`;
      const data = await fetch(url).then(json) as { prices: [number, number][] };
      const byDate = new Map<string, number>();
      for (const [ts, price] of data.prices || []) {
        byDate.set(new Date(ts).toISOString().slice(0, 10), Math.round(price * 100) / 100);
      }
      return Array.from(byDate, ([date, value]) => ({ date, value }));
    });
    res.json(result);
  } catch {
    res.json([]);
  }
});

// --- API: User currencies CRUD ---
app.get('/api/user-currencies', (req, res) => {
  res.json(getUserCurrencies(req.user!.user_id));
});
app.post('/api/user-currencies', (req, res) => {
  const { code, name } = req.body as { code: string; name: string };
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  addUserCurrency(req.user!.user_id, code, name);
  res.json({ ok: true });
});
app.delete('/api/user-currencies/:code', (req, res) => {
  deleteUserCurrency(req.user!.user_id, req.params.code);
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
  } catch {
    res.json([]);
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
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// --- API: User stocks CRUD ---
app.get('/api/user-stocks', (req, res) => {
  const stocks = getUserStocks(req.user!.user_id);
  res.json(stocks);
});

app.post('/api/user-stocks', (req, res) => {
  const { symbol, name } = req.body as { symbol: string; name: string };
  if (!symbol || !name) return res.status(400).json({ error: 'symbol and name required' });
  addUserStock(req.user!.user_id, symbol, name);
  res.json({ ok: true });
});

app.delete('/api/user-stocks/:symbol', (req, res) => {
  deleteUserStock(req.user!.user_id, req.params.symbol);
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
  } catch {
    res.json([]);
  }
});

// --- API: RSS Widgets CRUD ---
app.get('/api/rss-widgets', (req, res) => {
  res.json(getRssWidgets(req.user!.user_id));
});

app.post('/api/rss-widgets', (req, res) => {
  const { name } = req.body as { name: string };
  if (!name) return res.status(400).json({ error: 'name required' });
  const widget = createRssWidget(req.user!.user_id, name);
  res.json(widget);
});

app.put('/api/rss-widgets/:id', (req, res) => {
  const { name } = req.body as { name: string };
  if (!name) return res.status(400).json({ error: 'name required' });
  updateRssWidget(req.user!.user_id, req.params.id, name);
  res.json({ ok: true });
});

app.delete('/api/rss-widgets/:id', (req, res) => {
  deleteRssWidget(req.user!.user_id, req.params.id);
  res.json({ ok: true });
});

app.post('/api/rss-widgets/:id/feeds', (req, res) => {
  const { url: rawUrl, name, articles_count } = req.body as { url: string; name: string; articles_count?: number };
  const url = rawUrl?.trim();
  if (!url || !name) return res.status(400).json({ error: 'url and name required' });
  try {
    const feed = addRssFeed(req.params.id, url, name, articles_count || 3);
    res.json(feed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error';
    res.status(400).json({ error: msg });
  }
});

app.delete('/api/rss-widgets/:widgetId/feeds/:feedId', (req, res) => {
  deleteRssFeed(req.params.widgetId, req.params.feedId);
  res.json({ ok: true });
});

// --- API: RSS proxy ---
app.get('/api/rss', async (req, res) => {
  const { url } = req.query;
  try {
    const feed = await rssParser.parseURL(url as string);
    res.json(feed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// --- API: List user's Google Calendars ---
app.get('/api/calendars', async (req, res) => {
  const userId = req.user!.user_id;

  const oauth2Client = getOAuth2ClientForUser(userId);
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

    const prefs = getCalendarPrefs(userId);
    res.json({ calendars, prefs });
  } catch (e: unknown) {
    console.error('Calendar list error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// --- API: Save calendar preferences ---
app.post('/api/calendars/prefs', async (req, res) => {
  const userId = req.user!.user_id;
  const { prefs } = req.body as { prefs: { calendar_id: string; calendar_name: string; enabled: boolean }[] };

  if (!Array.isArray(prefs)) {
    return res.status(400).json({ error: 'Nieprawidlowe dane' });
  }

  saveCalendarPrefs(userId, prefs);
  res.json({ ok: true });
});

// --- API: Google Calendar events (per-user, multi-calendar) ---
app.get('/api/calendar', async (req, res) => {
  const userId = req.user!.user_id;
  const { timeMin, timeMax } = req.query;

  const oauth2Client = getOAuth2ClientForUser(userId);
  if (!oauth2Client) {
    return res.json({ error: { message: 'Kalendarz nie polaczony. Przejdz do ustawien konta.' } });
  }

  try {
    const cal = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get enabled calendars from prefs, default to primary only
    const prefs = getCalendarPrefs(userId);
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
        } catch {
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
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.json({ error: { message: `Blad kalendarza: ${msg}` } });
  }
});

// --- API: Dashboard layout ---
app.get('/api/layout', (req, res) => {
  const userId = req.user!.user_id;
  const layout = getLayout(userId);
  res.json({ layout });
});

app.put('/api/layout', (req, res) => {
  const userId = req.user!.user_id;
  const { layout } = req.body as { layout: unknown };
  if (!layout) {
    return res.status(400).json({ error: 'Brak danych layoutu' });
  }
  saveLayout(userId, layout);
  res.json({ ok: true });
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
});
