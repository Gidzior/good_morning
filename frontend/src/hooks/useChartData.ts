import { useState, useEffect, useCallback, useRef } from 'react';
import type { ChartPoint } from '../types';
import { CHART_CACHE_TTL } from '../config';

/**
 * Shared hook for fetching and caching chart data.
 * Used by Crypto, Currencies, and Stocks components.
 */
export function useChartData(url: string | null, tick: number) {
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const cache = useRef(new Map<string, { data: ChartPoint[]; ts: number }>());

  const load = useCallback(() => {
    if (!url) return;
    const entry = cache.current.get(url);
    if (entry && Date.now() - entry.ts < CHART_CACHE_TTL) {
      setChart(entry.data);
      setChartLoading(false);
      return;
    }
    setChartLoading(true);
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((pts: ChartPoint[]) => {
        const data = Array.isArray(pts) ? pts : [];
        cache.current.set(url, { data, ts: Date.now() });
        setChart(data);
        setChartLoading(false);
      })
      .catch((err) => { console.error(`Failed to load chart from ${url}:`, err); setChartLoading(false); });
  }, [url]);

  useEffect(() => { load(); }, [load, tick]);

  return { chart, chartLoading };
}
