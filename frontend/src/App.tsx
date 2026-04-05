import { useState, useEffect } from 'react';
import config from './config';
import { useRefresh } from './hooks/useRefresh';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppSidebar from './components/AppSidebar';
import DashboardHeader from './components/DashboardHeader';
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
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar lastUpdate={lastUpdate} countdown={countdown} onRefresh={refresh} />
        <SidebarInset>
          <DashboardHeader now={now} />
          <div className="p-6 max-sm:p-4">
            <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:[&_.col-span-2]:col-span-1 max-sm:[&_.col-span-3]:col-span-1 max-lg:[&_.col-span-3]:col-span-2">
              <Weather tick={tick} />
              <Quote tick={tick} />
              <Calendar tick={tick} />
              <Nameday tick={tick} />
              <BTC tick={tick} />
              <Stocks tick={tick} />
              <div className="col-span-3 grid grid-cols-2 gap-5 max-lg:col-span-2 max-sm:col-span-1 max-sm:grid-cols-1">
                <NewsPL tick={tick} />
                <RSS tick={tick} />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
