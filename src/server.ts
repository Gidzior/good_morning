import express from 'express';
import path from 'path';
import fetch from 'node-fetch';
import RSSParser from 'rss-parser';

const app = express();
const PORT = 3001;
const rssParser = new RSSParser();

// Serve built React app
app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));

// --- API: Weather ---
app.get('/api/weather', async (req, res) => {
  const { apiKey, city, country } = req.query;
  try {
    const [current, forecast] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city},${country}&appid=${apiKey}&units=metric&lang=pl`).then((r: any) => r.json()),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${city},${country}&appid=${apiKey}&units=metric&lang=pl`).then((r: any) => r.json()),
    ]);
    res.json({ current, forecast });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: BTC from Zonda ---
app.get('/api/btc', async (_req, res) => {
  try {
    const r = await fetch('https://api.zondacrypto.exchange/rest/trading/ticker/BTC-PLN');
    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
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
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: RSS ---
app.get('/api/rss', async (req, res) => {
  const { url } = req.query;
  try {
    const feed = await rssParser.parseURL(url as string);
    res.json(feed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: Nameday ---
app.get('/api/nameday', async (_req, res) => {
  try {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const r = await fetch(`https://api.abalin.net/getnames?country=pl&day=${day}&month=${month}`);
    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: News PL ---
app.get('/api/news-pl', async (_req, res) => {
  try {
    const feed = await rssParser.parseURL('https://wiadomosci.gazeta.pl/pub/rss/wiadomosci.xml');
    res.json(feed);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// --- API: Google Calendar ---
app.get('/api/calendar', async (req, res) => {
  const { apiKey, calendarId, timeMin, timeMax } = req.query;
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId as string)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=30`;
    const r = await fetch(url);
    const data = await r.json();
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dashboard server running at http://localhost:${PORT}`);
});
