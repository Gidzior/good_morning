import { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import type { ChartPoint } from '../types';
import { PERIODS, CHART_CACHE_TTL } from '../config';
import { fmtPLN, fmtChartDate } from '../utils';
import Loading from './Loading';
import Card from './DashboardCard';
import SettingsModal from './SettingsModal';
import { TickerGrid } from './TickerCards';
import type { TickerData } from './TickerCards';
import { cn } from '@/lib/utils';

interface CryptoDef { symbol: string; name: string }
interface CryptoResult { symbol: string; name: string; price: number; change: number; error?: boolean }

export default function Crypto({ tick }: { tick: number }) {
  const [cryptos, setCryptos] = useState<CryptoDef[]>([]);
  const [results, setResults] = useState<CryptoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState('');
  const [period, setPeriod] = useState(30);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);
  const chartCache = useRef(new Map<string, { data: ChartPoint[]; ts: number }>());

  const [showSettings, setShowSettings] = useState(false);
  const [available, setAvailable] = useState<CryptoDef[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/user-cryptos').then(r => r.json()).then((data: CryptoDef[]) => {
      setCryptos(data);
      if (data.length && !active) setActive(data[0].symbol);
    });
  }, []);

  useEffect(() => {
    if (!cryptos.length) { setLoading(false); setResults([]); return; }
    setLoading(true);
    Promise.all(
      cryptos.map(async (c) => {
        try {
          const res = await fetch(`/api/crypto/${encodeURIComponent(c.symbol)}`);
          const data = await res.json();
          const price = parseFloat(data.ticker.rate);
          const prev = parseFloat(data.ticker.previousRate);
          return { symbol: c.symbol, name: c.name, price, change: prev ? ((price - prev) / prev) * 100 : 0 };
        } catch {
          return { symbol: c.symbol, name: c.name, price: 0, change: 0, error: true };
        }
      })
    ).then(r => { setResults(r); setLoading(false); });
  }, [cryptos, tick]);

  const loadChart = useCallback(() => {
    if (!active) return;
    const key = `crypto-${active}-${period}`;
    const entry = chartCache.current.get(key);
    if (entry && Date.now() - entry.ts < CHART_CACHE_TTL) {
      setChart(entry.data); setChartLoading(false); return;
    }
    setChartLoading(true);
    fetch(`/api/crypto/${encodeURIComponent(active)}/history?days=${period}`)
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
      fetch('/api/cryptos/available').then(r => r.json()).then(setAvailable);
    }
  };

  const addCrypto = async (c: CryptoDef) => {
    if (cryptos.find(x => x.symbol === c.symbol)) return;
    await fetch('/api/user-cryptos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    setCryptos(prev => [...prev, c]);
    if (!active) setActive(c.symbol);
  };

  const removeCrypto = async (symbol: string) => {
    await fetch(`/api/user-cryptos/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
    setCryptos(prev => prev.filter(c => c.symbol !== symbol));
    if (active === symbol) {
      const remaining = cryptos.filter(c => c.symbol !== symbol);
      setActive(remaining[0]?.symbol || '');
    }
  };

  const filtered = query ? available.filter(a => a.symbol.toLowerCase().includes(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase())) : available;
  const activeTicker = results.find(r => r.symbol === active);
  const isBig = (activeTicker?.price ?? 0) >= 1000;

  const tickers: TickerData[] = results.map(r => ({
    id: r.symbol,
    label: `${r.symbol}/PLN`,
    displayValue: r.price >= 1000 ? `${(r.price / 1000).toFixed(1)}k` : fmtPLN(r.price),
    unit: 'zl',
    change: r.change,
    error: r.error,
  }));

  const chartConfig = { value: { label: activeTicker?.symbol ?? 'Kurs', color: 'var(--chart-1)' } } satisfies ChartConfig;

  return (
    <Card icon="🪙" title="Kryptowaluty" span={3} onSettings={openSettings}>
      {loading ? <Loading text="Ladowanie krypto..." /> :
       results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <p className="text-sm">Brak kryptowalut</p>
          <button onClick={openSettings} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">+ Dodaj krypto</button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground">
                {activeTicker && !activeTicker.error ? fmtPLN(activeTicker.price) : '—'} <span className="text-sm font-normal text-muted-foreground">zl</span>
              </div>
              <div className="text-xs text-muted-foreground">{activeTicker?.symbol}/PLN — {activeTicker?.name}</div>
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
                    <linearGradient id="cryptoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={d => fmtChartDate(d, period)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="equidistantPreserveStart" minTickGap={40} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={isBig ? 70 : 50}
                    tickFormatter={(v: number) => isBig ? `${(v / 1000).toFixed(0)}k` : v.toFixed(2)} />
                  <ChartTooltip content={
                    <ChartTooltipContent
                      labelFormatter={(label) => new Date(String(label)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      formatter={(value) => <span className="font-mono font-medium">{fmtPLN(Number(value))} zl</span>}
                    />
                  } />
                  <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} fill="url(#cryptoGradient)" dot={false} activeDot={{ r: 4, fill: 'var(--color-value)', strokeWidth: 0 }} />
                </AreaChart>
              </ChartContainer>
            }
          </div>

          <TickerGrid items={tickers} active={active} onSelect={setActive} />
        </>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} title="Zarzadzaj kryptowalutami">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Szukaj (np. BTC, ETH, SOL)..."
          className="mb-3 w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary" autoFocus />
        <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border">
          {filtered.slice(0, 20).map(c => (
            <button key={c.symbol} onClick={() => addCrypto(c)}
              disabled={!!cryptos.find(x => x.symbol === c.symbol)}
              className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary',
                cryptos.find(x => x.symbol === c.symbol) && 'opacity-40')}>
              <span><span className="font-medium">{c.symbol}</span> — {c.name}</span>
              {cryptos.find(x => x.symbol === c.symbol) ? <span className="text-xs text-muted-foreground">dodana</span> : <span className="text-primary">+</span>}
            </button>
          ))}
        </div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Twoje krypto ({cryptos.length})</div>
        {cryptos.length === 0 ? <p className="text-sm text-muted-foreground">Brak — wybierz powyzej</p> : (
          <div className="space-y-1">
            {cryptos.map(c => (
              <div key={c.symbol} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm"><span className="font-medium">{c.symbol}</span> — {c.name}</span>
                <button onClick={() => removeCrypto(c.symbol)} className="text-red hover:text-red/80 text-lg leading-none">&times;</button>
              </div>
            ))}
          </div>
        )}
      </SettingsModal>
    </Card>
  );
}
