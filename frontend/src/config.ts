import type { Config } from './types';

export const PERIODS = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1R', days: 365 },
] as const;

export const CHART_CACHE_TTL = 30 * 60 * 1000;

const config: Config = {
  STOCKS: [
    { symbol: 'CDR.WA', name: 'CD Projekt' },
    { symbol: 'ALE.WA', name: 'Allegro' },
    { symbol: 'DEL.WA', name: 'Delko' },
  ],

  CITIES: [
    { label: 'Warszawa', city: 'Warszawa', country: 'PL' },
    { label: 'Paryz', city: 'Paris', country: 'FR' },
  ],

  REFRESH_INTERVAL: 3 * 60 * 60 * 1000,
};

export default config;
