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

export interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  isoDate?: string;
}

export interface CalendarEvent {
  summary?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  calendarColor?: string;
}

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
}

export interface ChartPoint {
  date: string;
  value: number;
}

export type Breakpoint = 'lg' | 'md' | 'sm';

export type BreakpointLayouts = Record<Breakpoint, LayoutItem[]>;

export type WidgetId = 'weather' | 'quote' | 'calendar' | 'crypto' | 'currencies' | 'stocks' | 'todos' | `rss-${string}`;
