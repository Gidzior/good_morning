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
