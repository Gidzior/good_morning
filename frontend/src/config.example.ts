import type { Config } from './types';

const config: Config = {
  WEATHER_API_KEY: 'TWOJ_KLUCZ_OPENWEATHERMAP',
  WEATHER_CITY: 'Warszawa',
  WEATHER_COUNTRY: 'PL',

  GOOGLE_CALENDAR_API_KEY: 'TWOJ_KLUCZ_GOOGLE_CALENDAR',
  GOOGLE_CALENDAR_ID: 'primary',

  RSS_FEEDS: [
    { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'Niebezpiecznik', url: 'https://niebezpiecznik.pl/feed/' },
  ],
  RSS_ARTICLES_PER_FEED: 4,

  STOCKS: [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'CDR.WA', name: 'CD Projekt' },
  ],

  REFRESH_INTERVAL: 3 * 60 * 60 * 1000,
};

export default config;
