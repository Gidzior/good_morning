import { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import type { ChartPoint } from '../types';
import { PERIODS, CHART_CACHE_TTL } from '../config';
import { fmtPLN, fmtChartDate } from '../utils';
import Loading from './Loading';
import { Button } from '@/components/ui/button';
import Card from './DashboardCard';
import SettingsModal from './SettingsModal';
import { TickerGrid } from './TickerCards';
import type { TickerData } from './TickerCards';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CurrencyDef { code: string; name: string }
interface CurrencyResult { code: string; name: string; mid: number; change: number; error?: boolean }

export default function Currencies({ tick }: { tick: number }) {
  const [currencies, setCurrencies] = useState<CurrencyDef[]>([]);
  const [results, setResults] = useState<CurrencyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('');
  const [period, setPeriod] = useState(30);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const chartCache = useRef(new Map<string, { data: ChartPoint[]; ts: number }>());

  const [showSettings, setShowSettings] = useState(false);
  const [available, setAvailable] = useState<CurrencyDef[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/user-currencies').then(r => r.json()).then((data: CurrencyDef[]) => {
      setCurrencies(data);
      if (data.length && !active) setActive(data[0].code);
    });
  }, []);

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

  const loadChart = useCallback(() => {
    if (!active) return;
    const key = `cur-${active}-${period}`;
    const entry = chartCache.current.get(key);
    if (entry && Date.now() - entry.ts < CHART_CACHE_TTL) {
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
  }, [active, period]);

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

  const tickers: TickerData[] = results.map(r => ({
    id: r.code,
    label: `${r.code}/PLN`,
    displayValue: fmtPLN(r.mid, 4),
    unit: 'zl',
    change: r.change,
    error: r.error,
  }));

  const chartConfig = { value: { label: activeTicker?.code ?? 'Kurs', color: 'var(--chart-1)' } } satisfies ChartConfig;

  return (
    <Card icon="💱" title="Waluty" span={3} onSettings={openSettings}>
      {loading ? <Loading text="Ladowanie walut..." /> :
       results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <p className="text-sm">Brak walut</p>
          <Button onClick={openSettings}>+ Dodaj waluty</Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground">
                {activeTicker && !activeTicker.error ? fmtPLN(activeTicker.mid, 4) : '—'} <span className="text-sm font-normal text-muted-foreground">zl</span>
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
                  <XAxis dataKey="date" tickFormatter={d => fmtChartDate(d, period)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="equidistantPreserveStart" minTickGap={40} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={(v: number) => v.toFixed(2)} />
                  <ChartTooltip content={
                    <ChartTooltipContent
                      labelFormatter={(label) => new Date(String(label)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      formatter={(value) => <span className="font-mono font-medium">{fmtPLN(Number(value), 4)} zl</span>}
                    />
                  } />
                  <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} fill="url(#currGradient)" dot={false} activeDot={{ r: 4, fill: 'var(--color-value)', strokeWidth: 0 }} />
                </AreaChart>
              </ChartContainer>
            }
          </div>

          <TickerGrid items={tickers} active={active} onSelect={setActive} />
        </>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} title="Zarzadzaj walutami">
        <Input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Szukaj (np. USD, EUR, funt)..."
          className="mb-3" autoFocus />
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
                <button onClick={() => removeCurrency(c.code)} className="text-destructive hover:text-destructive/80 text-lg leading-none">&times;</button>
              </div>
            ))}
          </div>
        )}
      </SettingsModal>
    </Card>
  );
}
