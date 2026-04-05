import { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import type { ZondaResponse } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './DashboardCard';
import { cn } from '@/lib/utils';

function fmtPLN(val: number): string {
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface NBPRate {
  currency: string;
  code: string;
  mid: number;
  prev?: number;
}

interface ChartPoint {
  date: string;
  value: number;
}

type ActiveTicker = 'BTC' | 'USD' | 'EUR';

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1R', days: 365 },
] as const;

export default function BTC({ tick }: { tick: number }) {
  const [data, setData] = useState<ZondaResponse | null>(null);
  const [currencies, setCurrencies] = useState<NBPRate[]>([]);
  const [error, setError] = useState('');
  const [active, setActive] = useState<ActiveTicker>('BTC');
  const [period, setPeriod] = useState(30);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const chartCache = useRef(new Map<string, { data: ChartPoint[]; ts: number }>());
  const CACHE_TTL = 30 * 60 * 1000; // 30 min

  // Fetch current rates
  useEffect(() => {
    fetch('/api/btc')
      .then(r => r.json())
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message));

    fetch('/api/currencies')
      .then(r => r.json())
      .then(d => setCurrencies(d))
      .catch(() => {});
  }, [tick]);

  // Fetch chart data with client-side cache
  const loadChart = useCallback(() => {
    const key = `${active}-${period}`;
    const entry = chartCache.current.get(key);

    // Use cache if fresh
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      setChart(entry.data);
      setChartLoading(false);
      return;
    }

    setChartLoading(true);
    const url = active === 'BTC'
      ? `/api/btc/history?days=${period}`
      : `/api/currencies/history/${active}?days=${period}`;

    fetch(url)
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

  // Compute ticker data for boxes
  const btcPrice = data?.ticker ? parseFloat(data.ticker.rate) : 0;
  const btcPrev = data?.ticker ? parseFloat(data.ticker.previousRate) : 0;
  const btcChange = btcPrev ? ((btcPrice - btcPrev) / btcPrev) * 100 : 0;

  const tickers: { key: ActiveTicker; label: string; sublabel: string; price: number; change: number; unit: string }[] = [
    { key: 'BTC', label: 'BTC/PLN', sublabel: 'Bitcoin', price: btcPrice, change: btcChange, unit: 'zl' },
    ...currencies.map(c => ({
      key: c.code as ActiveTicker,
      label: `${c.code}/PLN`,
      sublabel: c.currency,
      price: c.mid,
      change: c.prev ? ((c.mid - c.prev) / c.prev) * 100 : 0,
      unit: 'zl',
    })),
  ];

  const activeTicker = tickers.find(t => t.key === active);

  // Chart date formatter
  const fmtDate = (d: string) => {
    const date = new Date(d);
    if (period <= 90) return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    return date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
  };

  // shadcn chart config
  const chartConfig = {
    value: {
      label: activeTicker?.label ?? 'Kurs',
      color: 'var(--chart-1)',
    },
  } satisfies ChartConfig;

  return (
    <Card icon="💱" title="Kursy walut i BTC" span={2}>
      {error ? <ErrorMsg message={error} /> :
       !data ? <Loading text="Ladowanie kursow..." /> :
       data.status !== 'Ok' ? <ErrorMsg message="Zonda API error" /> :
       <>
        {/* Chart header */}
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-foreground">
              {activeTicker ? fmtPLN(activeTicker.price) : '—'} zl
            </div>
            <div className="text-xs text-muted-foreground">
              {activeTicker?.label} — {activeTicker?.sublabel}
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
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
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
                  width={active === 'BTC' ? 70 : 45}
                  tickFormatter={(v: number) => active === 'BTC' ? `${(v / 1000).toFixed(0)}k` : v.toFixed(2)}
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
                          {fmtPLN(Number(value))} zl
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
                  fill="url(#chartGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: 'var(--color-value)', strokeWidth: 0 }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>

        {/* Ticker boxes */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          {tickers.map(t => {
            const isUp = t.change > 0;
            const isDown = t.change < 0;
            return (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all',
                  active === t.key
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
                )}
              >
                <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
                <div className="mt-1 text-base font-bold text-foreground">
                  {active === 'BTC' && t.key === 'BTC'
                    ? fmtPLN(t.price)
                    : t.key === 'BTC'
                      ? `${(t.price / 1000).toFixed(1)}k`
                      : fmtPLN(t.price)
                  }
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{t.unit}</span>
                </div>
                <div className={cn(
                  'mt-0.5 text-xs font-medium',
                  isUp && 'text-green',
                  isDown && 'text-red',
                  !isUp && !isDown && 'text-muted-foreground',
                )}>
                  {isUp ? '+' : ''}{t.change.toFixed(2)}%
                </div>
              </button>
            );
          })}
        </div>
       </>
      }
    </Card>
  );
}
