export const REFRESH_INTERVAL = 3 * 60 * 60 * 1000;

export const PERIODS = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1R', days: 365 },
] as const;

// 5 min — backend cache'uje dane wykresow przez 30 min (server.ts THIRTY_MIN); frontendowy TTL musi byc krotszy, inaczej worst-case staleness ~60 min
export const CHART_CACHE_TTL = 5 * 60 * 1000;
