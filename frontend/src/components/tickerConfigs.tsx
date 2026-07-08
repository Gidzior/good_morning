import { CoinsIcon, BanknoteIcon, TrendingUpIcon } from 'lucide-react';
import type { TickerConfig, TickerItem, TickerPrice } from './TickerWidget';
import { fmtPLN } from '../utils';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** parseFloat dla stringow (jak stare komponenty), przepuszcza liczby, reszta → NaN */
function toNum(v: unknown): number {
  if (typeof v === 'string') return parseFloat(v);
  if (typeof v === 'number') return v;
  return NaN;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<unknown>;
}

const PRICE_ERROR: TickerPrice = { value: 0, change: 0, error: true };

/** Elementy list z polem `symbol` (crypto, stocks, wyniki search) */
function parseSymbolItem(raw: unknown): TickerItem | null {
  return isRecord(raw) && typeof raw.symbol === 'string' && typeof raw.name === 'string'
    ? { id: raw.symbol, name: raw.name }
    : null;
}

/** Elementy list z polem `code` (waluty) */
function parseCodeItem(raw: unknown): TickerItem | null {
  return isRecord(raw) && typeof raw.code === 'string' && typeof raw.name === 'string'
    ? { id: raw.code, name: raw.name }
    : null;
}

export const CRYPTO_CONFIG: TickerConfig = {
  title: 'Kryptowaluty',
  icon: <CoinsIcon />,
  settingsTitle: 'Zarzadzaj kryptowalutami',
  gradientId: 'cryptoGradient',
  listUrl: '/api/user-cryptos',
  addUrl: '/api/user-cryptos',
  addBody: item => ({ symbol: item.id, name: item.name }),
  deleteUrl: id => `/api/user-cryptos/${encodeURIComponent(id)}`,
  parseListItem: parseSymbolItem,
  fetchPrice: async (id) => {
    try {
      const data = await fetchJson(`/api/crypto/${encodeURIComponent(id)}`);
      if (!isRecord(data) || !isRecord(data.ticker)) throw new Error('Invalid crypto response shape');
      const price = toNum(data.ticker.rate);
      const prev = toNum(data.ticker.previousRate);
      if (!Number.isFinite(price)) throw new Error('Missing crypto rate');
      return { value: price, change: prev ? ((price - prev) / prev) * 100 : 0 };
    } catch (err) {
      console.error(`Failed to fetch crypto ${id}:`, err);
      return PRICE_ERROR;
    }
  },
  historyUrl: (id, days) => `/api/crypto/${encodeURIComponent(id)}/history?days=${days}`,
  cardLabel: id => `${id}/PLN`,
  chartLabel: item => item.id,
  mainDisplay: p => fmtPLN(p.value),
  displayValue: p => (p.value >= 1000 ? `${(p.value / 1000).toFixed(1)}k` : fmtPLN(p.value)),
  unit: () => 'zl',
  yAxis: (activeValue) => {
    const isBig = activeValue >= 1000;
    return {
      width: isBig ? 70 : 50,
      tickFormatter: (v: number) => (isBig ? `${(v / 1000).toFixed(0)}k` : v.toFixed(2)),
    };
  },
  tooltipFormatter: v => `${fmtPLN(v)} zl`,
  picker: { kind: 'available', url: '/api/cryptos/available' },
  texts: {
    loading: 'Ładowanie krypto...',
    empty: 'Brak kryptowalut',
    addButton: '+ Dodaj krypto',
    searchPlaceholder: 'Szukaj (np. BTC, ETH, SOL)...',
    userListLabel: 'Twoje krypto',
    userListEmpty: 'Brak — wybierz powyżej',
    chartEmpty: 'Brak danych',
  },
};

export const CURRENCIES_CONFIG: TickerConfig = {
  title: 'Waluty',
  icon: <BanknoteIcon />,
  settingsTitle: 'Zarzadzaj walutami',
  gradientId: 'currGradient',
  listUrl: '/api/user-currencies',
  addUrl: '/api/user-currencies',
  addBody: item => ({ code: item.id, name: item.name }),
  deleteUrl: id => `/api/user-currencies/${encodeURIComponent(id)}`,
  parseListItem: parseCodeItem,
  fetchPrice: async (id) => {
    try {
      const data = await fetchJson(`/api/currency/${encodeURIComponent(id)}`);
      if (!isRecord(data) || typeof data.mid !== 'number') throw new Error('Invalid currency response shape');
      const mid = data.mid;
      // prev moze byc undefined (brak danych z poprzedniego dnia) → change 0
      const prev = typeof data.prev === 'number' ? data.prev : undefined;
      const change = prev ? ((mid - prev) / prev) * 100 : 0;
      return { value: mid, change };
    } catch (err) {
      console.error(`Failed to fetch currency ${id}:`, err);
      return PRICE_ERROR;
    }
  },
  historyUrl: (id, days) => `/api/currencies/history/${encodeURIComponent(id)}?days=${days}`,
  cardLabel: id => `${id}/PLN`,
  chartLabel: item => item.id,
  mainDisplay: p => fmtPLN(p.value, 4),
  displayValue: p => fmtPLN(p.value, 4),
  unit: () => 'zl',
  yAxis: () => ({ width: 50, tickFormatter: (v: number) => v.toFixed(2) }),
  tooltipFormatter: v => `${fmtPLN(v, 4)} zl`,
  picker: { kind: 'available', url: '/api/currencies/available' },
  texts: {
    loading: 'Ładowanie walut...',
    empty: 'Brak walut',
    addButton: '+ Dodaj waluty',
    searchPlaceholder: 'Szukaj (np. USD, EUR, funt)...',
    userListLabel: 'Twoje waluty',
    userListEmpty: 'Brak — wybierz powyżej',
    chartEmpty: 'Brak danych',
  },
};

export const STOCKS_CONFIG: TickerConfig = {
  title: 'Akcje',
  icon: <TrendingUpIcon />,
  settingsTitle: 'Zarzadzaj spolkami',
  gradientId: 'stockGradient',
  listUrl: '/api/user-stocks',
  addUrl: '/api/user-stocks',
  addBody: item => ({ symbol: item.id, name: item.name }),
  deleteUrl: id => `/api/user-stocks/${encodeURIComponent(id)}`,
  parseListItem: parseSymbolItem,
  fetchPrice: async (id) => {
    try {
      const data = await fetchJson(`/api/stock/${encodeURIComponent(id)}`);
      if (!isRecord(data) || !isRecord(data.chart) || !Array.isArray(data.chart.result)) {
        throw new Error('Invalid stock response shape');
      }
      const first: unknown = data.chart.result[0];
      if (!isRecord(first) || !isRecord(first.meta)) throw new Error('Invalid stock response shape');
      const meta = first.meta;
      const price = toNum(meta.regularMarketPrice);
      if (!Number.isFinite(price)) throw new Error('Missing stock price');
      // fallback jak w starym Stocks.tsx: chartPreviousClose || previousClose
      const prev = toNum(meta.chartPreviousClose) || toNum(meta.previousClose);
      const currency =
        typeof meta.currency === 'string' && meta.currency !== '' ? meta.currency : 'PLN';
      return { value: price, change: ((price - prev) / prev) * 100, currency };
    } catch (err) {
      console.error(`Failed to fetch stock ${id}:`, err);
      return PRICE_ERROR;
    }
  },
  historyUrl: (id, days) => `/api/stock/${encodeURIComponent(id)}/history?days=${days}`,
  cardLabel: id => id,
  chartLabel: item => item.name,
  mainDisplay: p => fmtPLN(p.value),
  displayValue: p => fmtPLN(p.value),
  unit: p => p.currency || 'PLN',
  yAxis: () => ({ width: 55, tickFormatter: (v: number) => fmtPLN(v) }),
  tooltipFormatter: (v, p) => `${fmtPLN(v)} ${p?.currency || 'PLN'}`,
  picker: { kind: 'search', url: q => `/api/stocks/search?q=${encodeURIComponent(q)}` },
  texts: {
    loading: 'Ładowanie kursów...',
    empty: 'Brak akcji do wyswietlenia',
    addButton: '+ Dodaj spółki',
    searchPlaceholder: 'Szukaj spółki (np. orlen, allegro)...',
    userListLabel: 'Twoje spółki',
    userListEmpty: 'Brak — wyszukaj i dodaj spółki powyżej',
    chartEmpty: 'Brak danych dla wybranego okresu',
  },
};
