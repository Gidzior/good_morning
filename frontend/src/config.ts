import type { Config } from './types';

const config: Config = {
  STOCKS: [
    { symbol: 'CDR.WA', name: 'CD Projekt' },
    { symbol: 'ALE.WA', name: 'Allegro' },
  ],

  REFRESH_INTERVAL: 3 * 60 * 60 * 1000,
};

export default config;
