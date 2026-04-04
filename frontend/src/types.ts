export interface WeatherData {
  main: { temp: number; feels_like: number; humidity: number };
  weather: { description: string; icon: string }[];
  wind: { speed: number };
  cod: number;
  message?: string;
}

export interface ForecastItem {
  dt: number;
  main: { temp: number };
  weather: { description: string; icon: string }[];
}

export interface ForecastData {
  list: ForecastItem[];
}

export interface WeatherResponse {
  current: WeatherData;
  forecast: ForecastData;
}

export interface ZondaTicker {
  rate: string;
  previousRate: string;
  highestBid: string;
  lowestAsk: string;
}

export interface ZondaResponse {
  status: string;
  ticker: ZondaTicker;
}

export interface StockMeta {
  regularMarketPrice: number;
  chartPreviousClose?: number;
  previousClose?: number;
  currency?: string;
}

export interface StockResponse {
  chart: { result: { meta: StockMeta }[] };
}

export interface StockConfig {
  symbol: string;
  name: string;
}

export interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
}

export interface RSSFeed {
  items: RSSItem[];
}

export interface RSSFeedConfig {
  name: string;
  url: string;
}

export interface CalendarEvent {
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

export interface CalendarResponse {
  items?: CalendarEvent[];
  error?: { message: string };
}

export interface NamedayResponse {
  results?: { namedays?: { pl?: string } };
}

export interface Config {
  WEATHER_API_KEY: string;
  WEATHER_CITY: string;
  WEATHER_COUNTRY: string;
  GOOGLE_CALENDAR_API_KEY: string;
  GOOGLE_CALENDAR_ID: string;
  RSS_FEEDS: RSSFeedConfig[];
  RSS_ARTICLES_PER_FEED: number;
  STOCKS: StockConfig[];
  REFRESH_INTERVAL: number;
}
