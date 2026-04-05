import type { Config } from './types';

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
