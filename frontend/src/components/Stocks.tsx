import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import Loading from './Loading';
import Card from './DashboardCard';
import { cn } from '@/lib/utils';

function fmtPrice(val: number): string {
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface StockDef { symbol: string; name: string }

interface StockResult {
  symbol: string;
  name: string;
  price?: number;
  change?: number;
  currency?: string;
  error?: boolean;
}

interface ChartPoint { date: string; value: number }
interface SearchResult { symbol: string; name: string }

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1R', days: 365 },
] as const;

export default function Stocks({ tick }: { tick: number }) {
  const [stocks, setStocks] = useState<StockDef[]>([]);
  const [results, setResults] = useState<StockResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('');
  const [period, setPeriod] = useState(30);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const chartCache = useRef(new Map<string, { data: ChartPoint[]; ts: number }>());
  const CACHE_TTL = 30 * 60 * 1000;

  // Settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load user stocks
  useEffect(() => {
    fetch('/api/user-stocks').then(r => r.json()).then((data: StockDef[]) => {
      setStocks(data);
      if (data.length && !active) setActive(data[0].symbol);
    });
  }, []);

  // Fetch current prices
  useEffect(() => {
    if (!stocks.length) { setLoading(false); setResults([]); return; }
    setLoading(true);
    Promise.all(
      stocks.map(async (stock) => {
        try {
          const res = await fetch(`/api/stock/${encodeURIComponent(stock.symbol)}`);
          const data = await res.json();
          const meta = data.chart.result[0].meta;
          const price = meta.regularMarketPrice;
          const prev = meta.chartPreviousClose || meta.previousClose;
          return { symbol: stock.symbol, name: stock.name, price, change: ((price - prev) / prev) * 100, currency: meta.currency || 'PLN' };
        } catch {
          return { symbol: stock.symbol, name: stock.name, error: true };
        }
      })
    ).then(r => { setResults(r); setLoading(false); });
  }, [stocks, tick]);

  // Chart
  const loadChart = useCallback(() => {
    if (!active) return;
    const key = `${active}-${period}`;
    const entry = chartCache.current.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      setChart(entry.data); setChartLoading(false); return;
    }
    setChartLoading(true);
    fetch(`/api/stock/${encodeURIComponent(active)}/history?days=${period}`)
      .then(r => r.json())
      .then((pts: ChartPoint[]) => {
        const data = Array.isArray(pts) ? pts : [];
        chartCache.current.set(key, { data, ts: Date.now() });
        setChart(data); setChartLoading(false);
      })
      .catch(() => setChartLoading(false));
  }, [active, period, CACHE_TTL]);

  useEffect(() => { loadChart(); }, [loadChart, tick]);

  // Search with debounce
  const handleSearch = (val: string) => {
    setQuery(val);
    clearTimeout(searchTimeout.current);
    if (val.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(() => {
      fetch(`/api/stocks/search?q=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then((data: SearchResult[]) => { setSearchResults(data); setSearching(false); })
        .catch(() => setSearching(false));
    }, 300);
  };

  const addStock = async (s: SearchResult) => {
    if (stocks.find(x => x.symbol === s.symbol)) return;
    await fetch('/api/user-stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    setStocks(prev => [...prev, s]);
    if (!active) setActive(s.symbol);
    setQuery(''); setSearchResults([]);
  };

  const removeStock = async (symbol: string) => {
    await fetch(`/api/user-stocks/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
    setStocks(prev => prev.filter(s => s.symbol !== symbol));
    if (active === symbol) {
      const remaining = stocks.filter(s => s.symbol !== symbol);
      setActive(remaining[0]?.symbol || '');
    }
  };

  const activeTicker = results.find(r => r.symbol === active);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    if (period <= 90) return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    return date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
  };

  const chartConfig = {
    value: { label: activeTicker?.name ?? 'Kurs', color: 'var(--chart-1)' },
  } satisfies ChartConfig;

  return (
    <Card icon="📈" title="Akcje" span={3} onSettings={() => setShowSettings(true)}>
      {loading ? (
        <Loading text="Ladowanie kursow..." />
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <p className="text-sm">Brak akcji do wyswietlenia</p>
          <button onClick={() => setShowSettings(true)} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">
            + Dodaj spolki
          </button>
        </div>
      ) : (
        <>
          {/* Chart header */}
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground">
                {activeTicker?.price != null ? fmtPrice(activeTicker.price) : '—'}{' '}
                <span className="text-sm font-normal text-muted-foreground">{activeTicker?.currency || 'PLN'}</span>
              </div>
              <div className="text-xs text-muted-foreground">{activeTicker?.symbol} — {activeTicker?.name}</div>
            </div>
            <div className="flex gap-1">
              {PERIODS.map(p => (
                <button key={p.days} onClick={() => setPeriod(p.days)} className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  period === p.days ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-primary/10',
                )}>{p.label}</button>
              ))}
            </div>
          </div>

          {/* Chart */}
          <div className="h-[190px] w-full">
            {chartLoading ? (
              <div className="flex h-full items-center justify-center"><Loading text="Ladowanie wykresu..." /></div>
            ) : chart.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Brak danych dla wybranego okresu</div>
            ) : (
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={chart} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="equidistantPreserveStart" minTickGap={40} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={55} tickFormatter={(v: number) => fmtPrice(v)} />
                  <ChartTooltip content={
                    <ChartTooltipContent
                      labelFormatter={(label) => new Date(String(label)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      formatter={(value) => <span className="font-mono font-medium">{fmtPrice(Number(value))} {activeTicker?.currency || 'PLN'}</span>}
                    />
                  } />
                  <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} fill="url(#stockGradient)" dot={false} activeDot={{ r: 4, fill: 'var(--color-value)', strokeWidth: 0 }} />
                </AreaChart>
              </ChartContainer>
            )}
          </div>

          {/* Ticker boxes — grid on desktop, list on mobile */}
          <div className="mt-4 hidden sm:grid" style={{ gridTemplateColumns: `repeat(${Math.min(results.length, 5)}, 1fr)`, gap: '0.75rem' }}>
            {results.map(s => <TickerCard key={s.symbol} s={s} active={active} onSelect={setActive} />)}
          </div>
          <div className="mt-4 flex flex-col gap-1 sm:hidden">
            {results.map(s => <TickerRow key={s.symbol} s={s} active={active} onSelect={setActive} />)}
          </div>
        </>
      )}

      {/* Settings modal */}
      {showSettings && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSettings(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Zarzadzaj spolkami</h3>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
            </div>

            {/* Search */}
            <input
              type="text"
              value={query}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Szukaj spolki (np. orlen, allegro)..."
              className="mb-3 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              autoFocus
            />
            {searching && <p className="mb-2 text-xs text-muted-foreground">Szukam...</p>}
            {searchResults.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border">
                {searchResults.map(s => (
                  <button
                    key={s.symbol}
                    onClick={() => addStock(s)}
                    disabled={!!stocks.find(x => x.symbol === s.symbol)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary',
                      stocks.find(x => x.symbol === s.symbol) && 'opacity-40',
                    )}
                  >
                    <span><span className="font-medium">{s.symbol}</span> — {s.name}</span>
                    {stocks.find(x => x.symbol === s.symbol) ? (
                      <span className="text-xs text-muted-foreground">dodana</span>
                    ) : (
                      <span className="text-primary">+</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Current stocks */}
            <div className="text-xs font-medium text-muted-foreground mb-2">Twoje spolki ({stocks.length})</div>
            {stocks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak — wyszukaj i dodaj spolki powyzej</p>
            ) : (
              <div className="space-y-1">
                {stocks.map(s => (
                  <div key={s.symbol} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm"><span className="font-medium">{s.symbol}</span> — {s.name}</span>
                    <button onClick={() => removeStock(s.symbol)} className="text-red hover:text-red/80 text-lg leading-none">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
      document.body)}
    </Card>
  );
}

function TickerCard({ s, active, onSelect }: { s: StockResult; active: string; onSelect: (sym: string) => void }) {
  const isUp = (s.change ?? 0) > 0;
  const isDown = (s.change ?? 0) < 0;
  return (
    <button onClick={() => onSelect(s.symbol)} className={cn(
      'rounded-lg border p-3 text-left transition-all',
      active === s.symbol ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
    )}>
      <div className="text-xs font-medium text-muted-foreground">{s.symbol}</div>
      <div className="mt-1 text-base font-bold text-foreground">
        {s.error ? '—' : fmtPrice(s.price!)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{s.currency || 'PLN'}</span>
      </div>
      <div className={cn('mt-0.5 text-xs font-medium', isUp && 'text-green', isDown && 'text-red', !isUp && !isDown && 'text-muted-foreground')}>
        {s.error ? '—' : `${isUp ? '+' : ''}${s.change!.toFixed(2)}%`}
      </div>
    </button>
  );
}

function TickerRow({ s, active, onSelect }: { s: StockResult; active: string; onSelect: (sym: string) => void }) {
  const isUp = (s.change ?? 0) > 0;
  const isDown = (s.change ?? 0) < 0;
  return (
    <button onClick={() => onSelect(s.symbol)} className={cn(
      'flex items-center justify-between rounded-lg border px-3 py-2 transition-all',
      active === s.symbol ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30',
    )}>
      <span className="text-xs font-medium text-muted-foreground">{s.symbol}</span>
      <span className="text-sm font-bold text-foreground">{s.error ? '—' : `${fmtPrice(s.price!)} ${s.currency || 'PLN'}`}</span>
      <span className={cn('text-xs font-medium', isUp && 'text-green', isDown && 'text-red', !isUp && !isDown && 'text-muted-foreground')}>
        {s.error ? '—' : `${isUp ? '+' : ''}${s.change!.toFixed(2)}%`}
      </span>
    </button>
  );
}
