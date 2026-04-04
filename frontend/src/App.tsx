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
    <div className="mx-auto max-w-[1400px] p-6 max-sm:p-4">
      <div className="mb-8 flex items-center justify-between border-b border-border pb-5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
        <div>
          <h1 className="bg-gradient-to-br from-accent-indigo-light to-blue-500 bg-clip-text text-[28px] font-bold text-transparent">
            {getGreeting()}
          </h1>
        </div>
        <div className="text-right text-sm text-muted-foreground max-sm:text-left">
          <div className="text-lg font-medium text-foreground">{formatDate(now)}</div>
          <div>{formatTime(now)}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-5 max-[1100px]:grid-cols-2 max-sm:grid-cols-1 max-sm:[&_.col-span-2]:col-span-1 max-sm:[&_.col-span-3]:col-span-1 max-[1100px]:[&_.col-span-3]:col-span-2">
        <Weather tick={tick} />
        <Quote tick={tick} />
        <Calendar tick={tick} />
        <Nameday tick={tick} />
        <BTC tick={tick} />
        <Stocks tick={tick} />
        <NewsPL tick={tick} />
        <RSS tick={tick} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between border-t border-border bg-card px-6 py-2 text-xs text-muted-foreground">
        <span>
          Ostatnia aktualizacja: {formatTime(lastUpdate)} | Nastepna za: {countdown || '—'}
        </span>
        <button
          onClick={refresh}
          className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-accent-indigo-light"
        >
          Odswiez teraz
        </button>
      </div>
    </div>
  );
}
