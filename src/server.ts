import 'dotenv/config';
import express from 'express';
import path from 'path';
import fetch, { Response } from 'node-fetch';
import RSSParser from 'rss-parser';

const app = express();
const PORT = 3001;
const rssParser = new RSSParser();

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

// --- API: Weather (keys from .env) ---
app.get('/api/weather', async (_req, res) => {
  const apiKey = process.env.WEATHER_API_KEY;
  const city = process.env.WEATHER_CITY || 'Warszawa';
  const country = process.env.WEATHER_COUNTRY || 'PL';

  if (!apiKey || apiKey === 'TWOJ_KLUCZ_OPENWEATHERMAP') {
    return res.json({ current: { cod: 401, message: 'Brak klucza API pogody w .env' }, forecast: { list: [] } });
  }

  try {
    const [current, forecast] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city},${country}&appid=${apiKey}&units=metric&lang=pl`).then(json),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city},${country}&appid=${apiKey}&units=metric&lang=pl`).then(json),
    ]);
    res.json({ current, forecast });
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

// --- API: RSS ---
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

// --- API: Google Calendar (keys from .env) ---
app.get('/api/calendar', async (req, res) => {
  const apiKey = process.env.GOOGLE_CALENDAR_API_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const { timeMin, timeMax } = req.query;

  if (!apiKey || apiKey === 'TWOJ_KLUCZ_GOOGLE_CALENDAR') {
    return res.json({ error: { message: 'Brak klucza API kalendarza w .env' } });
  }

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=30`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    res.status(500).json({ error: msg });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
});
