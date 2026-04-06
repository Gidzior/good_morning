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
  calendarColor?: string;
}

export interface CalendarResponse {
  items?: CalendarEvent[];
  error?: { message: string };
}

export interface NamedayResponse {
  results?: { namedays?: { pl?: string } };
}

export interface CityConfig {
  label: string;
  city: string;
  country: string;
}

export interface Config {
  STOCKS: StockConfig[];
  CITIES: CityConfig[];
  REFRESH_INTERVAL: number;
}
