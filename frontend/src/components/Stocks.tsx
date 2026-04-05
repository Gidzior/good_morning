import { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import config from '../config';
import type { StockConfig } from '../types';
import Loading from './Loading';
import Card from './DashboardCard';
import { cn } from '@/lib/utils';

function fmtPrice(val: number): string {
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface StockResult {
  config: StockConfig;
  price?: number;
  change?: number;
  currency?: string;
  error?: boolean;
}

interface ChartPoint {
  date: string;
  value: number;
}

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1R', days: 365 },
] as const;

export default function Stocks({ tick }: { tick: number }) {
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(config.STOCKS[0]?.symbol || '');
  const [period, setPeriod] = useState(30);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const chartCache = useRef(new Map<string, { data: ChartPoint[]; ts: number }>());
  const CACHE_TTL = 30 * 60 * 1000;

  // Fetch current prices
  useEffect(() => {
    if (!config.STOCKS.length) { setLoading(false); return; }

    Promise.all(
      config.STOCKS.map(async (stock) => {
        try {
          const res = await fetch(`/api/stock/${encodeURIComponent(stock.symbol)}`);
          const data = await res.json();
          const meta = data.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          return {
            config: stock,
            price,
            change: ((price - prev) / prev) * 100,
            currency: meta.currency || 'PLN',
          };
        } catch {
          return { config: stock, error: true };
        }
      })
    ).then(r => { setResults(r); setLoading(false); });
  }, [tick]);

  // Fetch chart data with client-side cache
  const loadChart = useCallback(() => {
    if (!active) return;
    const key = `${active}-${period}`;
    const entry = chartCache.current.get(key);

    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      setChart(entry.data);
      setChartLoading(false);
      return;
    }

    setChartLoading(true);
    fetch(`/api/stock/${encodeURIComponent(active)}/history?days=${period}`)
      .then(r => r.json())
      .then((pts: ChartPoint[]) => {
        const data = Array.isArray(pts) ? pts : [];
        chartCache.current.set(key, { data, ts: Date.now() });
        setChart(data);
        setChartLoading(false);
      })
      .catch(() => setChartLoading(false));
  }, [active, period, CACHE_TTL]);

  useEffect(() => { loadChart(); }, [loadChart, tick]);

  const activeTicker = results.find(r => r.config.symbol === active);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    if (period <= 90) return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    return date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
  };

  const chartConfig = {
    value: {
      label: activeTicker?.config.name ?? 'Kurs',
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig;

  return (
    <Card icon="📈" title="Akcje" span={3}>
      {loading ? (
        <Loading text="Ladowanie kursow..." />
      ) : results.length === 0 ? (
        <div className="cal-empty">Dodaj akcje w config.ts</div>
      ) : (
        <>
          {/* Chart header */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground">
                {activeTicker?.price != null ? fmtPrice(activeTicker.price) : '—'}{' '}
                <span className="text-sm font-normal text-muted-foreground">
                  {activeTicker?.currency || 'PLN'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {activeTicker?.config.symbol} — {activeTicker?.config.name}
              </div>
            </div>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button
                  key={p.days}
                  onClick={() => setPeriod(p.days)}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    period === p.days
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-primary/10',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="h-[200px] w-full">
            {chartLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loading text="Ladowanie wykresu..." />
              </div>
            ) : chart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Brak danych dla wybranego okresu
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={chart} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    interval="equidistantPreserveStart"
                    minTickGap={40}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={55}
                    tickFormatter={(v: number) => fmtPrice(v)}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) =>
                          new Date(String(label)).toLocaleDateString('pl-PL', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })
                        }
                        formatter={(value) => (
                          <span className="font-mono font-medium">
                            {fmtPrice(Number(value))} {activeTicker?.currency || 'PLN'}
                          </span>
                        )}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="var(--color-value)"
                    strokeWidth={2}
                    fill="url(#stockGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--color-value)', strokeWidth: 0 }}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </div>

          {/* Ticker boxes */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {results.map(s => {
              const isUp = (s.change ?? 0) > 0;
              const isDown = (s.change ?? 0) < 0;
              return (
                <button
                  key={s.config.symbol}
                  onClick={() => setActive(s.config.symbol)}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all',
                    active === s.config.symbol
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
                  )}
                >
                  <div className="text-xs font-medium text-muted-foreground">{s.config.symbol}</div>
                  <div className="mt-1 text-base font-bold text-foreground">
                    {s.error ? '—' : fmtPrice(s.price!)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {s.currency || 'PLN'}
                    </span>
                  </div>
                  <div className={cn(
                    'mt-0.5 text-xs font-medium',
                    isUp && 'text-green',
                    isDown && 'text-red',
                    !isUp && !isDown && 'text-muted-foreground',
                  )}>
                    {s.error ? '—' : `${isUp ? '+' : ''}${s.change!.toFixed(2)}%`}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
