import { useState, useEffect } from 'react';
import config from '../config';
import { formatTime } from '../utils';
import type { WeatherResponse, ForecastItem } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './Card';

export default function Weather({ tick }: { tick: number }) {
  const [data, setData] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!config.WEATHER_API_KEY || config.WEATHER_API_KEY === 'TWOJ_KLUCZ_OPENWEATHERMAP') return;
    const url = `/api/weather?apiKey=${config.WEATHER_API_KEY}&city=${config.WEATHER_CITY}&country=${config.WEATHER_COUNTRY}`;
    fetch(url)
      .then(r => r.json())
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message));
  }, [tick]);

  const noKey = !config.WEATHER_API_KEY || config.WEATHER_API_KEY === 'TWOJ_KLUCZ_OPENWEATHERMAP';

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

  return (
    <>
      <Card icon="🌤" title="Pogoda teraz">
        {noKey ? (
          <div className="weather-main">
            <div>
              <div className="weather-temp">--°C</div>
              <div className="weather-desc">
                Uzupelnij WEATHER_API_KEY w config.ts
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
    </>
  );
}
