import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import Loading from './Loading';
import Card from './DashboardCard';
import { cn } from '@/lib/utils';

function fmtPLN(val: number): string {
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

interface CurrencyDef { code: string; name: string }
interface CurrencyResult { code: string; name: string; mid: number; change: number; error?: boolean }
interface ChartPoint { date: string; value: number }

const PERIODS = [
  { label: '7D', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '1R', days: 365 },
] as const;

export default function Currencies({ tick }: { tick: number }) {
  const [currencies, setCurrencies] = useState<CurrencyDef[]>([]);
  const [results, setResults] = useState<CurrencyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('');
  const [period, setPeriod] = useState(30);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const chartCache = useRef(new Map<string, { data: ChartPoint[]; ts: number }>());
  const CACHE_TTL = 30 * 60 * 1000;

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [available, setAvailable] = useState<CurrencyDef[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/user-currencies').then(r => r.json()).then((data: CurrencyDef[]) => {
      setCurrencies(data);
      if (data.length && !active) setActive(data[0].code);
    });
  }, []);

  // Fetch current rates from NBP
  useEffect(() => {
    if (!currencies.length) { setLoading(false); setResults([]); return; }
    setLoading(true);
    Promise.all(
      currencies.map(async (c) => {
        try {
          const res = await fetch(`/api/currency/${encodeURIComponent(c.code)}`);
          const data = await res.json();
          const change = data.prev ? ((data.mid - data.prev) / data.prev) * 100 : 0;
          return { code: c.code, name: c.name, mid: data.mid, change };
        } catch {
          return { code: c.code, name: c.name, mid: 0, change: 0, error: true };
        }
      })
    ).then(r => { setResults(r); setLoading(false); });
  }, [currencies, tick]);

  // Chart
  const loadChart = useCallback(() => {
    if (!active) return;
    const key = `cur-${active}-${period}`;
    const entry = chartCache.current.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) {
      setChart(entry.data); setChartLoading(false); return;
    }
    setChartLoading(true);
    fetch(`/api/currencies/history/${encodeURIComponent(active)}?days=${period}`)
      .then(r => r.json())
      .then((pts: ChartPoint[]) => {
        const data = Array.isArray(pts) ? pts : [];
        chartCache.current.set(key, { data, ts: Date.now() });
        setChart(data); setChartLoading(false);
      })
      .catch(() => setChartLoading(false));
  }, [active, period, CACHE_TTL]);

  useEffect(() => { loadChart(); }, [loadChart, tick]);

  const openSettings = () => {
    setShowSettings(true);
    if (!available.length) {
      fetch('/api/currencies/available').then(r => r.json()).then(setAvailable);
    }
  };

  const addCurrency = async (c: CurrencyDef) => {
    if (currencies.find(x => x.code === c.code)) return;
    await fetch('/api/user-currencies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    setCurrencies(prev => [...prev, c]);
    if (!active) setActive(c.code);
  };

  const removeCurrency = async (code: string) => {
    await fetch(`/api/user-currencies/${encodeURIComponent(code)}`, { method: 'DELETE' });
    setCurrencies(prev => prev.filter(c => c.code !== code));
    if (active === code) {
      const remaining = currencies.filter(c => c.code !== code);
      setActive(remaining[0]?.code || '');
    }
  };

  const filtered = query ? available.filter(a => a.code.toLowerCase().includes(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase())) : available;
  const activeTicker = results.find(r => r.code === active);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    if (period <= 90) return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    return date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
  };

  const chartConfig = { value: { label: activeTicker?.code ?? 'Kurs', color: 'var(--chart-1)' } } satisfies ChartConfig;

  return (
    <Card icon="💱" title="Waluty" span={3} onSettings={openSettings}>
      {loading ? <Loading text="Ladowanie walut..." /> :
       results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <p className="text-sm">Brak walut</p>
          <button onClick={openSettings} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">+ Dodaj waluty</button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground">
                {activeTicker && !activeTicker.error ? fmtPLN(activeTicker.mid) : '—'} <span className="text-sm font-normal text-muted-foreground">zl</span>
              </div>
              <div className="text-xs text-muted-foreground">{activeTicker?.code}/PLN — {activeTicker?.name}</div>
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

          <div className="h-[190px] w-full">
            {chartLoading ? <div className="flex h-full items-center justify-center"><Loading text="Ladowanie wykresu..." /></div> :
             chart.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Brak danych</div> :
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={chart} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="currGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="equidistantPreserveStart" minTickGap={40} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => v.toFixed(2)} />
                  <ChartTooltip content={
                    <ChartTooltipContent
                      labelFormatter={(label) => new Date(String(label)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      formatter={(value) => <span className="font-mono font-medium">{fmtPLN(Number(value))} zl</span>}
                    />
                  } />
                  <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} fill="url(#currGradient)" dot={false} activeDot={{ r: 4, fill: 'var(--color-value)', strokeWidth: 0 }} />
                </AreaChart>
              </ChartContainer>
            }
          </div>

          <div className="mt-4 hidden sm:grid" style={{ gridTemplateColumns: `repeat(${Math.min(results.length, 5)}, 1fr)`, gap: '0.75rem' }}>
            {results.map(t => <TickerCard key={t.code} t={t} active={active} onSelect={setActive} />)}
          </div>
          <div className="mt-4 flex flex-col gap-1 sm:hidden">
            {results.map(t => <TickerRow key={t.code} t={t} active={active} onSelect={setActive} />)}
          </div>
        </>
      )}

      {showSettings && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowSettings(false)}>
          <div className="mx-4 w-full max-w-md rounded-xl bg-card p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Zarzadzaj walutami</h3>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
            </div>
            <input type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Szukaj (np. USD, EUR, funt)..."
              className="mb-3 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" autoFocus />
            <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border">
              {filtered.slice(0, 20).map(c => (
                <button key={c.code} onClick={() => addCurrency(c)}
                  disabled={!!currencies.find(x => x.code === c.code)}
                  className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary',
                    currencies.find(x => x.code === c.code) && 'opacity-40')}>
                  <span><span className="font-medium">{c.code}</span> — {c.name}</span>
                  {currencies.find(x => x.code === c.code) ? <span className="text-xs text-muted-foreground">dodana</span> : <span className="text-primary">+</span>}
                </button>
              ))}
            </div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Twoje waluty ({currencies.length})</div>
            {currencies.length === 0 ? <p className="text-sm text-muted-foreground">Brak — wybierz powyzej</p> : (
              <div className="space-y-1">
                {currencies.map(c => (
                  <div key={c.code} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm"><span className="font-medium">{c.code}</span> — {c.name}</span>
                    <button onClick={() => removeCurrency(c.code)} className="text-red hover:text-red/80 text-lg leading-none">&times;</button>
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

function TickerCard({ t, active, onSelect }: { t: CurrencyResult; active: string; onSelect: (s: string) => void }) {
  const isUp = t.change > 0, isDown = t.change < 0;
  return (
    <button onClick={() => onSelect(t.code)} className={cn(
      'rounded-lg border p-3 text-left transition-all',
      active === t.code ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
    )}>
      <div className="text-xs font-medium text-muted-foreground">{t.code}/PLN</div>
      <div className="mt-1 text-base font-bold text-foreground">
        {t.error ? '—' : fmtPLN(t.mid)}<span className="ml-1 text-xs font-normal text-muted-foreground">zl</span>
      </div>
      <div className={cn('mt-0.5 text-xs font-medium', isUp && 'text-green', isDown && 'text-red', !isUp && !isDown && 'text-muted-foreground')}>
        {t.error ? '—' : `${isUp ? '+' : ''}${t.change.toFixed(2)}%`}
      </div>
    </button>
  );
}

function TickerRow({ t, active, onSelect }: { t: CurrencyResult; active: string; onSelect: (s: string) => void }) {
  const isUp = t.change > 0, isDown = t.change < 0;
  return (
    <button onClick={() => onSelect(t.code)} className={cn(
      'flex items-center justify-between rounded-lg border px-3 py-2 transition-all',
      active === t.code ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30',
    )}>
      <span className="text-xs font-medium text-muted-foreground">{t.code}/PLN</span>
      <span className="text-sm font-bold text-foreground">{t.error ? '—' : `${fmtPLN(t.mid)} zl`}</span>
      <span className={cn('text-xs font-medium', isUp && 'text-green', isDown && 'text-red', !isUp && !isDown && 'text-muted-foreground')}>
        {t.error ? '—' : `${isUp ? '+' : ''}${t.change.toFixed(2)}%`}
      </span>
    </button>
  );
}
