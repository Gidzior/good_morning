import { useState, useEffect } from 'react';
import config from './config';
import { formatDate, formatTime, getGreeting } from './utils';
import { useRefresh } from './hooks/useRefresh';
import Weather from './components/Weather';
import Calendar from './components/Calendar';
import BTC from './components/BTC';
import Stocks from './components/Stocks';
import RSS from './components/RSS';
import NewsPL from './components/NewsPL';
import Quote from './components/Quote';
import Nameday from './components/Nameday';
import './App.css';

export default function App() {
  const { lastUpdate, countdown, refresh, tick } = useRefresh(config.REFRESH_INTERVAL);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="container">
      <div className="header">
        <div>
          <h1>{getGreeting()}</h1>
        </div>
        <div className="header-meta">
          <div className="date">{formatDate(now)}</div>
          <div>{formatTime(now)}</div>
        </div>
      </div>

      <div className="grid">
        <Weather tick={tick} />
        <Quote tick={tick} />
        <Calendar tick={tick} />
        <Nameday tick={tick} />
        <BTC tick={tick} />
        <Stocks tick={tick} />
        <NewsPL tick={tick} />
        <RSS tick={tick} />
      </div>

      <div className="refresh-bar">
        <span>
          Ostatnia aktualizacja: {formatTime(lastUpdate)} | Nastepna za: {countdown || '—'}
        </span>
        <button onClick={refresh}>Odswiez teraz</button>
      </div>
    </div>
  );
}
