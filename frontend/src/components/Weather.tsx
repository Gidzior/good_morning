import { useState, useEffect } from 'react';
import { formatTime } from '../utils';
import type { WeatherResponse, ForecastItem } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './DashboardCard';
import config from '../config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function Weather({ tick }: { tick: number }) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState('');
  const [cityIdx, setCityIdx] = useState(0);

  const selected = config.CITIES[cityIdx];

  useEffect(() => {
    setData(null);
    setError('');
    fetch(`/api/weather?city=${encodeURIComponent(selected.city)}&country=${encodeURIComponent(selected.country)}`)
      .then(r => r.json())
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message));
  }, [tick, selected.city, selected.country]);

  const noKey = data?.current?.cod === 401;

  // Today's forecast items
  const todayStr = new Date().toDateString();
  const forecasts: ForecastItem[] = data?.forecast?.list
    ?.filter(item => new Date(item.dt * 1000).toDateString() === todayStr)
    .slice(0, 5) ?? [];

  // If no forecasts for today, try tomorrow
  const tomorrowStr = new Date(Date.now() + 86400000).toDateString();
  const displayForecasts = forecasts.length > 0
    ? forecasts
    : (data?.forecast?.list?.filter(item => new Date(item.dt * 1000).toDateString() === tomorrowStr).slice(0, 5) ?? []);

  // 3-day forecast: group by day, get max temp + most common icon (noon preferred)
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
      // prefer noon icon (12:00-15:00), fallback to first
      const noonItem = items.find(i => {
        const h = new Date(i.dt * 1000).getHours();
        return h >= 12 && h <= 15;
      });
      const icon = (noonItem || items[0]).weather[0].icon;
      days.push({ date: new Date(dayStr), maxTemp, icon });
    }
    return days;
  })();

  const citySelect = (
    <Select
      value={selected.city}
      onValueChange={(v) => {
        const idx = config.CITIES.findIndex(c => c.city === v);
        if (idx >= 0) setCityIdx(idx);
      }}
    >
      <SelectTrigger className="h-7 w-[130px] border-border bg-secondary text-xs">
        <SelectValue placeholder={selected.label} />
      </SelectTrigger>
      <SelectContent>
        {config.CITIES.map((c) => (
          <SelectItem key={c.city} value={c.city}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="grid grid-cols-2 gap-5 max-sm:grid-cols-1">
      <Card icon="🌤" title="Pogoda" action={citySelect}>
        {noKey ? (
          <div className="weather-main">
            <div>
              <div className="weather-temp">--°C</div>
              <div className="weather-desc">
                Uzupelnij WEATHER_API_KEY w pliku .env
              </div>
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
        {noKey ? (
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
    </div>
  );
}
