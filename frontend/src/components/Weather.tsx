import { useState, useEffect, useCallback, useRef } from 'react';
import { formatTime } from '../utils';
import type { WeatherResponse, ForecastItem } from '../types';
import Loading, { ErrorMsg } from './Loading';
import SettingsModal from './SettingsModal';
import Card from './DashboardCard';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
      .then(r => r.json())
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
      .then(r => r.json())
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message));
  }, [tick, selected?.lat, selected?.lon]);

  const handleSearch = (val: string) => {
    setQuery(val);
    if (debounce.current) clearTimeout(debounce.current);
    if (val.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    debounce.current = setTimeout(() => {
      fetch(`/api/cities/search?q=${encodeURIComponent(val)}`)
        .then(r => r.json())
        .then((data: SearchResult[] | unknown) => { setSearchResults(Array.isArray(data) ? data : []); setSearching(false); })
        .catch(() => setSearching(false));
    }, 400);
  };

  const addCity = async (c: SearchResult) => {
    await fetch('/api/user-cities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: c.lat, lon: c.lon, name: c.name, country: c.country }),
    });
    loadCities();
    setQuery('');
    setSearchResults([]);
  };

  const removeCity = async (c: CityConfig) => {
    await fetch('/api/user-cities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: c.lat, lon: c.lon }),
    });
    if (cityIdx >= cities.length - 1 && cityIdx > 0) setCityIdx(cityIdx - 1);
    loadCities();
  };

  const noKey = data?.current?.cod === 401;

  const todayStr = new Date().toDateString();
  const forecasts: ForecastItem[] = data?.forecast?.list
    ?.filter(item => new Date(item.dt * 1000).toDateString() === todayStr)
    .slice(0, 5) ?? [];

  const tomorrowStr = new Date(Date.now() + 86400000).toDateString();
  const displayForecasts = forecasts.length > 0
    ? forecasts
    : (data?.forecast?.list?.filter(item => new Date(item.dt * 1000).toDateString() === tomorrowStr).slice(0, 5) ?? []);

  interface DaySummary { date: Date; maxTemp: number; icon: string }
  const dailyForecast: DaySummary[] = (() => {
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
      if (days.length >= 3) break;
      const maxTemp = Math.max(...items.map(i => i.main.temp));
      const noonItem = items.find(i => {
        const h = new Date(i.dt * 1000).getHours();
        return h >= 12 && h <= 15;
      });
      const icon = (noonItem || items[0]).weather[0].icon;
      days.push({ date: new Date(dayStr), maxTemp, icon });
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
  ) : null;

  return (
    <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
      <Card icon="🌤" title="Pogoda" action={cityTabs} onSettings={() => setShowSettings(true)}>
        {cities.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Brak miast. Kliknij <button onClick={() => setShowSettings(true)} className="text-primary underline">⚙ ustawienia</button> zeby dodac.
          </div>
        ) : noKey ? (
          <div className="weather-main">
            <div>
              <div className="weather-temp">--°C</div>
              <div className="weather-desc">Uzupelnij WEATHER_API_KEY w pliku .env</div>
            </div>
          </div>
        ) : error ? (
          <ErrorMsg message={`Blad pogody: ${error}`} />
        ) : !data ? (
          <Loading text="Ladowanie pogody..." />
        ) : data.current.cod !== 200 ? (
          <ErrorMsg message={`Blad: ${data.current.message}`} />
        ) : (
          <>
            <div className="weather-main">
              <img
                className="weather-icon"
                src={`https://openweathermap.org/img/wn/${data.current.weather[0].icon}@2x.png`}
                alt=""
              />
              <div>
                <div className="weather-temp">{Math.round(data.current.main.temp)}°C</div>
                <div className="weather-desc">{data.current.weather[0].description}</div>
              </div>
            </div>
            <div className="weather-details">
              <div className="weather-detail">
                <div className="label">Odczuwalna</div>
                <div className="value">{Math.round(data.current.main.feels_like)}°</div>
              </div>
              <div className="weather-detail">
                <div className="label">Wilgotnosc</div>
                <div className="value">{data.current.main.humidity}%</div>
              </div>
              <div className="weather-detail">
                <div className="label">Wiatr</div>
                <div className="value">{Math.round(data.current.wind.speed * 3.6)} km/h</div>
              </div>
            </div>
            {dailyForecast.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {dailyForecast.map((day, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-secondary px-2 py-2">
                    <img
                      src={`https://openweathermap.org/img/wn/${day.icon}@2x.png`}
                      alt=""
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="flex min-w-0 flex-col">
                      <span className="text-xs font-medium capitalize text-foreground">
                        {day.date.toLocaleDateString('pl-PL', { weekday: 'short' })}
                      </span>
                      <span className="text-sm font-bold text-foreground">
                        {Math.round(day.maxTemp)}°
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      <Card icon="📅" title="Prognoza na dzis">
        {cities.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">Dodaj miasto w ustawieniach pogody</div>
        ) : noKey ? (
          <ErrorMsg message="Brak klucza API pogody" />
        ) : !data ? (
          <Loading text="Ladowanie prognozy..." />
        ) : displayForecasts.length === 0 ? (
          <div className="cal-empty">Brak danych prognozy</div>
        ) : (
          displayForecasts.map((item, i) => (
            <div className="forecast-row" key={i}>
              <span className="time">{formatTime(new Date(item.dt * 1000))}</span>
              <img src={`https://openweathermap.org/img/wn/${item.weather[0].icon}.png`} alt="" />
              <span className="temp">{Math.round(item.main.temp)}°C</span>
              <span className="desc">{item.weather[0].description}</span>
            </div>
          ))
        )}
      </Card>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} title="Zarzadzaj miastami">
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
              <p className="text-sm text-muted-foreground">Brak — wyszukaj i dodaj miasta powyzej</p>
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
    </div>
  );
}
