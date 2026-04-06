import { useState, useEffect } from 'react';
import config from './config';
import { useRefresh } from './hooks/useRefresh';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppSidebar from './components/AppSidebar';
import DashboardHeader from './components/DashboardHeader';
import LoginPage from './components/LoginPage';
import AccountPage from './components/AccountPage';
import Weather from './components/Weather';
import Calendar from './components/Calendar';
import BTC from './components/BTC';
import Stocks from './components/Stocks';
import RSS from './components/RSS';
import NewsPL from './components/NewsPL';
import Quote from './components/Quote';
import './App.css';

type Page = 'dashboard' | 'account';

function Dashboard() {
  const { lastUpdate, countdown, refresh, tick } = useRefresh(config.REFRESH_INTERVAL);
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState<Page>('dashboard');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (page === 'account') {
    return (
      <AccountPage
        onBack={() => setPage('dashboard')}
        lastUpdate={lastUpdate}
        countdown={countdown}
        onRefresh={refresh}
      />
    );
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          lastUpdate={lastUpdate}
          countdown={countdown}
          onRefresh={refresh}
          onAccount={() => setPage('account')}
        />
        <SidebarInset>
          <DashboardHeader now={now} />
          <div className="p-6 max-sm:p-4">
            <div className="grid grid-cols-3 gap-5 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:[&_.col-span-2]:col-span-1 max-sm:[&_.col-span-3]:col-span-1 max-lg:[&_.col-span-3]:col-span-2">
              <Weather tick={tick} />
              <Quote tick={tick} />
              <Calendar tick={tick} />
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

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-2xl text-primary-foreground">
            ☀
          </div>
          <div className="text-sm text-muted-foreground">Ladowanie...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
