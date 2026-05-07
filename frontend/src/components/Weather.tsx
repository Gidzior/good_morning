import { useState, useEffect, useCallback, useRef } from 'react';
import type { WeatherResponse, ForecastItem } from '../types';
import Loading, { ErrorMsg } from './Loading';
import SettingsModal from './SettingsModal';
import Card from './DashboardCard';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CloudSunIcon,
  SunIcon,
  CloudIcon,
  CloudRainIcon,
  CloudSnowIcon,
  CloudLightningIcon,
  CloudFogIcon,
  DropletIcon,
  WindIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CityConfig {
  lat: number;
  lon: number;
  name: string;
  country: string;
}

interface SearchResult {
  name: string;
  country: string;
  state: string;
  lat: number;
  lon: number;
}

function iconForOwm(code: string): LucideIcon {
  const id = code.slice(0, 2);
  switch (id) {
    case '01': return SunIcon;
    case '02': return CloudSunIcon;
    case '03':
    case '04': return CloudIcon;
    case '09':
    case '10': return CloudRainIcon;
    case '11': return CloudLightningIcon;
    case '13': return CloudSnowIcon;
    case '50': return CloudFogIcon;
    default: return CloudIcon;
  }
}

const PL_WEEKDAY_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

export default function Weather({ tick }: { tick: number }) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState('');
  const [cities, setCities] = useState<CityConfig[]>([]);
  const [cityIdx, setCityIdx] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const loadCities = useCallback(() => {
    fetch('/api/user-cities')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: CityConfig[]) => setCities(data))
      .catch(err => console.error('Failed to load cities:', err));
  }, []);

  useEffect(() => { loadCities(); }, [loadCities]);

  const selected = cities[cityIdx] || null;

  useEffect(() => {
    if (!selected) { setData(null); return; }
    setData(null);
    setError('');
    fetch(`/api/weather?lat=${selected.lat}&lon=${selected.lon}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setError(''); })
      .catch(e => { console.error('Weather fetch error:', e); setError(e instanceof Error ? e.message : 'Unknown error'); });
  }, [tick, selected?.lat, selected?.lon]);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (debounce.current) clearTimeout(debounce.current);
    if (val.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    debounce.current = setTimeout(() => {
      fetch(`/api/cities/search?q=${encodeURIComponent(val)}`)
        .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((data: SearchResult[] | unknown) => { setSearchResults(Array.isArray(data) ? data : []); setSearching(false); })
        .catch((err) => { console.error('City search failed:', err); setSearching(false); });
    }, 400);
  };

  const addCity = async (c: SearchResult) => {
    const r = await fetch('/api/user-cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: c.lat, lon: c.lon, name: c.name, country: c.country }),
    });
    if (!r.ok) { console.error('Failed to add city:', r.status); return; }
    loadCities();
    setQuery('');
    setSearchResults([]);
  };

  const removeCity = async (c: CityConfig) => {
    const r = await fetch('/api/user-cities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: c.lat, lon: c.lon }),
    });
    if (!r.ok) { console.error('Failed to remove city:', r.status); return; }
    if (cityIdx >= cities.length - 1 && cityIdx > 0) setCityIdx(cityIdx - 1);
    loadCities();
  };

  const noKey = data?.current?.cod === 401;

  // Hourly: next 8 forecast entries (3-hour intervals from OWM)
  const hourly: ForecastItem[] = data?.forecast?.list?.slice(0, 8) ?? [];

  // Daily: aggregate forecast list into per-day lo/hi for next 5 days (skipping today)
  interface DaySummary { date: Date; lo: number; hi: number; icon: string }
  const daily: DaySummary[] = (() => {
    if (!data?.forecast?.list) return [];
    const today = new Date().toDateString();
    const byDay = new Map<string, ForecastItem[]>();
    for (const item of data.forecast.list) {
      const dayStr = new Date(item.dt * 1000).toDateString();
      if (dayStr === today) continue;
      if (!byDay.has(dayStr)) byDay.set(dayStr, []);
      byDay.get(dayStr)!.push(item);
    }
    const days: DaySummary[] = [];
    for (const [dayStr, items] of byDay) {
      if (days.length >= 5) break;
      const temps = items.map(i => i.main.temp);
      const lo = Math.min(...temps);
      const hi = Math.max(...temps);
      const noon = items.find(i => {
        const h = new Date(i.dt * 1000).getHours();
        return h >= 12 && h <= 15;
      }) ?? items[0];
      days.push({ date: new Date(dayStr), lo, hi, icon: noon.weather[0].icon });
    }
    return days;
  })();

  const cityTabs = cities.length > 1 ? (
    <Select
      value={selected?.name ?? ''}
      onValueChange={(v: string) => {
        const idx = cities.findIndex(c => c.name === v);
        if (idx >= 0) setCityIdx(idx);
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {cities.map(c => (
          <SelectItem key={`${c.lat}-${c.lon}`} value={c.name}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  ) : (
    <span className="font-mono text-[11px] tracking-[0.04em] text-[color:var(--ink-3)]">
      {selected?.name ?? ''}
    </span>
  );

  const cityLabel = cities.length > 0 ? cityTabs : null;
  const renderBody = () => {
    if (cities.length === 0) {
      return (
        <div className="py-4 text-center text-sm text-[color:var(--ink-3)]">
          Brak miast. Kliknij{' '}
          <button onClick={() => setShowSettings(true)} className="text-[color:var(--accent)] underline">
            ustawienia
          </button>{' '}
          aby dodać.
        </div>
      );
    }
    if (noKey) return <ErrorMsg message="Brak klucza WEATHER_API_KEY w .env" />;
    if (error) return <ErrorMsg message={`Błąd pogody: ${error}`} />;
    if (!data) return <Loading text="Ładowanie pogody..." />;
    if (data.current.cod !== 200) return <ErrorMsg message={`Błąd: ${data.current.message}`} />;

    const TopIcon = iconForOwm(data.current.weather[0].icon);
    const temp = Math.round(data.current.main.temp);
    const feels = Math.round(data.current.main.feels_like);
    const humidity = data.current.main.humidity;
    const wind = Math.round(data.current.wind.speed * 3.6);
    const condition = data.current.weather[0].description;

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-4">
          <TopIcon className="size-14 shrink-0 text-[color:var(--accent)]" strokeWidth={1.4} />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-baseline gap-2.5">
              <span className="font-serif text-[44px] font-medium leading-none tracking-[-0.03em] text-[color:var(--ink)]">
                {temp}°
              </span>
              <span className="text-[11px] text-[color:var(--ink-3)]">odczuwalna {feels}°</span>
            </div>
            <div className="mt-0.5 text-[13px] capitalize text-[color:var(--ink-2)]">{condition}</div>
            <div className="mt-1.5 flex gap-3.5 text-[11.5px] text-[color:var(--ink-2)]">
              <span className="inline-flex items-center gap-1">
                <DropletIcon className="size-3 text-[color:var(--ink-3)]" />
                {humidity}%
              </span>
              <span className="inline-flex items-center gap-1">
                <WindIcon className="size-3 text-[color:var(--ink-3)]" />
                {wind} km/h
              </span>
            </div>
          </div>
        </div>

        {hourly.length > 0 && (
          <div className="grid grid-cols-8 gap-1 border-y border-[color:var(--line)] py-2.5">
            {hourly.map((h, i) => {
              const HourIcon = iconForOwm(h.weather[0].icon);
              const hour = new Date(h.dt * 1000).getHours();
              return (
                <div key={i} className="flex flex-col items-center gap-1 py-1">
                  <span className="font-mono text-[10.5px] text-[color:var(--ink-3)]">
                    {String(hour).padStart(2, '0')}
                  </span>
                  <HourIcon className="size-[18px] text-[color:var(--ink-2)]" strokeWidth={1.6} />
                  <span className="font-mono text-[12px] font-medium text-[color:var(--ink)]">
                    {Math.round(h.main.temp)}°
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {daily.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {daily.map((d, i) => {
              const DayIcon = iconForOwm(d.icon);
              const lo = Math.round(d.lo);
              const hi = Math.round(d.hi);
              const left = Math.max(0, Math.min(100, ((lo + 10) / 45) * 100));
              const width = Math.max(4, Math.min(100 - left, ((hi - lo) / 45) * 100));
              return (
                <div
                  key={i}
                  className="grid items-center gap-2.5 text-xs"
                  style={{ gridTemplateColumns: '28px 22px 1fr 70px' }}
                >
                  <span className="text-[color:var(--ink-2)]">
                    {PL_WEEKDAY_SHORT[d.date.getDay()]}
                  </span>
                  <DayIcon className="size-4 text-[color:var(--ink-2)]" strokeWidth={1.6} />
                  <div className="relative h-1 rounded-sm bg-[color:var(--bg)]">
                    <div
                      className="absolute top-0 h-1 rounded-sm"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: 'linear-gradient(90deg, #6FA8DC, #B7791F, #C0392B)',
                      }}
                    />
                  </div>
                  <span className="text-right font-mono text-[11.5px] text-[color:var(--ink-2)]">
                    {lo}° / {hi}°
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <Card icon={<CloudSunIcon />} title="Pogoda" action={cityLabel} onSettings={() => setShowSettings(true)}>
        {renderBody()}
      </Card>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} title="Zarządzaj miastami">
        <Input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="Szukaj miasta (np. Warszawa, Paris)..."
          className="mb-3"
          autoFocus
        />
        {searching && <p className="mb-2 text-xs text-muted-foreground">Szukam...</p>}
        {searchResults.length > 0 && (
          <div className="mb-4 max-h-40 overflow-y-auto rounded-lg border">
            {searchResults.map((c, i) => {
              const exists = cities.some(x => x.lat === c.lat && x.lon === c.lon);
              return (
                <button
                  key={i}
                  onClick={() => !exists && addCity(c)}
                  disabled={exists}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-secondary',
                    exists && 'opacity-40',
                  )}
                >
                  <span>
                    <span className="font-medium">{c.name}</span>
                    {c.state && <span className="text-muted-foreground">, {c.state}</span>}
                    <span className="text-muted-foreground"> ({c.country})</span>
                  </span>
                  {exists ? (
                    <span className="text-xs text-muted-foreground">dodane</span>
                  ) : (
                    <span className="text-primary">+</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="text-xs font-medium text-muted-foreground mb-2">Twoje miasta ({cities.length})</div>
        {cities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak — wyszukaj i dodaj miasta powyżej</p>
        ) : (
          <div className="space-y-1">
            {cities.map(c => (
              <div key={`${c.lat}-${c.lon}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="text-sm font-medium">{c.name} <span className="text-muted-foreground">({c.country})</span></span>
                <button onClick={() => removeCity(c)} className="ml-2 text-destructive hover:text-destructive/80 text-lg leading-none">&times;</button>
              </div>
            ))}
          </div>
        )}
      </SettingsModal>
    </>
  );
}
