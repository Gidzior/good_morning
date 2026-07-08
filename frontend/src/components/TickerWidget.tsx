import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { AreaChart, Area, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { PERIODS } from '../config';
import { useChartData } from '../hooks/useChartData';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { fmtChartDate } from '../utils';
import Loading, { ErrorMsg } from './Loading';
import { Button } from '@/components/ui/button';
import Card from './DashboardCard';
import SettingsModal from './SettingsModal';
import { TickerGrid } from './TickerCards';
import type { TickerData } from './TickerCards';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface TickerItem {
  id: string;
  name: string;
}

export interface TickerPrice {
  value: number;
  change: number;
  currency?: string;
  error?: boolean;
}

export interface TickerTexts {
  loading: string;
  empty: string;
  addButton: string;
  searchPlaceholder: string;
  userListLabel: string;
  userListEmpty: string;
  chartEmpty: string;
}

export type TickerPicker =
  | { kind: 'available'; url: string }
  | { kind: 'search'; url: (q: string) => string };

export interface TickerConfig {
  title: string;
  icon: ReactNode;
  settingsTitle: string;
  gradientId: string;
  listUrl: string;
  addUrl: string;
  addBody: (item: TickerItem) => Record<string, string>;
  deleteUrl: (id: string) => string;
  parseListItem: (raw: unknown) => TickerItem | null;
  fetchPrice: (id: string) => Promise<TickerPrice>;
  historyUrl: (id: string, days: number) => string;
  cardLabel: (id: string) => string;
  chartLabel: (item: TickerItem) => string;
  mainDisplay: (p: TickerPrice) => string;
  displayValue: (p: TickerPrice) => string;
  unit: (p: TickerPrice) => string;
  yAxis: (activeValue: number) => { width: number; tickFormatter: (v: number) => string };
  tooltipFormatter: (v: number, p?: TickerPrice) => string;
  picker: TickerPicker;
  texts: TickerTexts;
}

interface PricedItem extends TickerItem {
  price: TickerPrice;
}

interface PricedState {
  key: string;
  results: PricedItem[];
}

export default function TickerWidget({ config, tick }: { config: TickerConfig; tick: number }) {
  // items === null → lista usera jeszcze nie zaladowana
  const [items, setItems] = useState<TickerItem[] | null>(null);
  const [listError, setListError] = useState(false);
  const [priced, setPriced] = useState<PricedState | null>(null);
  const [active, setActive] = useState('');
  const [period, setPeriod] = useState(30);

  const [showSettings, setShowSettings] = useState(false);
  const [available, setAvailable] = useState<TickerItem[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TickerItem[]>([]);
  const [searching, setSearching] = useState(false);

  const picker = config.picker;

  const parseItems = useCallback(
    (data: unknown): TickerItem[] =>
      Array.isArray(data)
        ? data.map(config.parseListItem).filter((x): x is TickerItem => x !== null)
        : [],
    [config],
  );

  useEffect(() => {
    fetch(config.listUrl)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: unknown) => {
        const parsed = parseItems(data);
        setItems(parsed);
        if (parsed.length) setActive(prev => prev || parsed[0].id);
      })
      .catch((err) => {
        console.error(`Failed to load list from ${config.listUrl}:`, err);
        setItems([]);
        setListError(true);
      });
  }, [config, parseItems]);

  useEffect(() => {
    if (items === null || !items.length) return;
    const key = `${items.map(i => i.id).join(',')}|${tick}`;
    Promise.all(
      items.map(async (item): Promise<PricedItem> => {
        try {
          const price = await config.fetchPrice(item.id);
          return { ...item, price };
        } catch (err) {
          console.error(`Failed to fetch price for ${item.id}:`, err);
          return { ...item, price: { value: 0, change: 0, error: true } };
        }
      })
    ).then(r => setPriced({ key, results: r }));
  }, [items, tick, config]);

  // loading derywowane: spinner podczas ladowania listy oraz kazdego (re)fetchu cen
  const priceKey = items === null ? '' : `${items.map(i => i.id).join(',')}|${tick}`;
  const loading = !listError && (items === null || (items.length > 0 && priced?.key !== priceKey));
  const results: PricedItem[] = priced?.results ?? [];

  const chartUrl = active ? config.historyUrl(active, period) : null;
  const { chart, chartLoading } = useChartData(chartUrl, tick);

  const openSettings = () => {
    setShowSettings(true);
    if (picker.kind === 'available' && !available.length) {
      fetch(picker.url)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((data: unknown) => setAvailable(parseItems(data)))
        .catch(err => console.error('Failed to load available items:', err));
    }
  };

  const runSearch = useDebouncedCallback((val: string) => {
    if (picker.kind !== 'search') return;
    if (val.length < 2) { setSearchResults([]); setSearching(false); return; }
    fetch(picker.url(val))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: unknown) => { setSearchResults(parseItems(data)); setSearching(false); })
      .catch((err) => { console.error('Search failed:', err); setSearching(false); });
  }, 300);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (picker.kind !== 'search') return;
    if (val.length < 2) { setSearchResults([]); setSearching(false); }
    else setSearching(true);
    runSearch(val);
  };

  const userItems = items ?? [];

  const addItem = async (item: TickerItem) => {
    if (userItems.some(x => x.id === item.id)) return;
    const r = await fetch(config.addUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.addBody(item)),
    });
    if (!r.ok) { console.error('Failed to add item:', r.status); return; }
    setItems(prev => [...(prev ?? []), item]);
    setActive(prev => prev || item.id);
    if (picker.kind === 'search') { setQuery(''); setSearchResults([]); }
  };

  const removeItem = async (id: string) => {
    const r = await fetch(config.deleteUrl(id), { method: 'DELETE' });
    if (!r.ok) { console.error('Failed to remove item:', r.status); return; }
    const remaining = userItems.filter(i => i.id !== id);
    setItems(prev => (prev ?? []).filter(i => i.id !== id));
    setActive(prev => (prev === id ? (remaining[0]?.id ?? '') : prev));
  };

  const filtered = query
    ? available.filter(a => a.id.toLowerCase().includes(query.toLowerCase()) || a.name.toLowerCase().includes(query.toLowerCase()))
    : available;
  const activeResult = results.find(r => r.id === active);
  const activePrice = activeResult?.price;

  const tickers: TickerData[] = results.map(r => ({
    id: r.id,
    label: config.cardLabel(r.id),
    displayValue: r.price.error ? '—' : config.displayValue(r.price),
    unit: config.unit(r.price),
    change: r.price.change,
    error: r.price.error,
  }));

  const chartConfig = {
    value: { label: activeResult ? config.chartLabel(activeResult) : 'Kurs', color: 'var(--chart-1)' },
  } satisfies ChartConfig;
  const yAxisCfg = config.yAxis(activePrice?.value ?? 0);

  const isAdded = (id: string) => userItems.some(x => x.id === id);
  const renderPickButton = (t: TickerItem) => (
    <button key={t.id} onClick={() => addItem(t)}
      disabled={isAdded(t.id)}
      className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary',
        isAdded(t.id) && 'opacity-40')}>
      <span><span className="font-medium">{t.id}</span> — {t.name}</span>
      {isAdded(t.id) ? <span className="text-xs text-muted-foreground">dodana</span> : <span className="text-primary">+</span>}
    </button>
  );

  return (
    <Card icon={config.icon} title={config.title} onSettings={openSettings}>
      {listError ? <ErrorMsg message="Nie udało się załadować danych — odśwież stronę" /> :
       loading ? <Loading text={config.texts.loading} /> :
       userItems.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
          <p className="text-sm">{config.texts.empty}</p>
          <Button onClick={openSettings}>{config.texts.addButton}</Button>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-foreground">
                {activePrice && !activePrice.error ? config.mainDisplay(activePrice) : '—'}{' '}
                <span className="text-sm font-normal text-muted-foreground">{activePrice ? config.unit(activePrice) : ''}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {activeResult ? `${config.cardLabel(activeResult.id)} — ${activeResult.name}` : ''}
              </div>
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
            {chartLoading ? <div className="flex h-full items-center justify-center"><Loading text="Ładowanie wykresu..." /></div> :
             chart.length === 0 ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{config.texts.chartEmpty}</div> :
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={chart} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id={config.gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tickFormatter={d => fmtChartDate(d, period)} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval="equidistantPreserveStart" minTickGap={40} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={yAxisCfg.width} tickFormatter={yAxisCfg.tickFormatter} />
                  <ChartTooltip content={
                    <ChartTooltipContent
                      labelFormatter={(label) => new Date(String(label)).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                      formatter={(value) => <span className="font-mono font-medium">{config.tooltipFormatter(Number(value), activePrice)}</span>}
                    />
                  } />
                  <Area type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} fill={`url(#${config.gradientId})`} dot={false} activeDot={{ r: 4, fill: 'var(--color-value)', strokeWidth: 0 }} />
                </AreaChart>
              </ChartContainer>
            }
          </div>

          <TickerGrid items={tickers} active={active} onSelect={setActive} />
        </>
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} title={config.settingsTitle}>
        <Input type="text" value={query} onChange={e => handleQueryChange(e.target.value)}
          placeholder={config.texts.searchPlaceholder}
          className="mb-3" autoFocus />
        {picker.kind === 'search' ? (
          <>
            {searching && <p className="mb-2 text-xs text-muted-foreground">Szukam...</p>}
            {searchResults.length > 0 && (
              <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border">
                {searchResults.map(renderPickButton)}
              </div>
            )}
          </>
        ) : (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border">
            {filtered.slice(0, 20).map(renderPickButton)}
          </div>
        )}
        <div className="text-xs font-medium text-muted-foreground mb-2">{config.texts.userListLabel} ({userItems.length})</div>
        {userItems.length === 0 ? <p className="text-sm text-muted-foreground">{config.texts.userListEmpty}</p> : (
          <div className="space-y-1">
            {userItems.map(i => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm"><span className="font-medium">{i.id}</span> — {i.name}</span>
                <button onClick={() => removeItem(i.id)} className="text-destructive hover:text-destructive/80 text-lg leading-none">&times;</button>
              </div>
            ))}
          </div>
        )}
      </SettingsModal>
    </Card>
  );
}
