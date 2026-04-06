import { useState, useEffect, useMemo } from 'react';
import config from './config';
import { useRefresh } from './hooks/useRefresh';
import { useLayout } from './hooks/useLayout';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppSidebar from './components/AppSidebar';
import DashboardHeader from './components/DashboardHeader';
import DashboardGrid from './components/DashboardGrid';
import LoginPage from './components/LoginPage';
import AccountPage from './components/AccountPage';
import Weather from './components/Weather';
import Calendar from './components/Calendar';
import BTC from './components/BTC';
import Stocks from './components/Stocks';
import RSS from './components/RSS';
import NewsPL from './components/NewsPL';
import Quote from './components/Quote';
import type { WidgetId } from './types';
import './App.css';

type Page = 'dashboard' | 'account';

function Dashboard() {
  const { lastUpdate, countdown, refresh, tick } = useRefresh(config.REFRESH_INTERVAL);
  const { layout, loaded, editMode, setEditMode, onLayoutChange, resetLayout } = useLayout();
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState<Page>('dashboard');

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const widgets = useMemo(() => [
    { id: 'weather' as WidgetId, node: <Weather tick={tick} /> },
    { id: 'quote' as WidgetId, node: <Quote tick={tick} /> },
    { id: 'calendar' as WidgetId, node: <Calendar tick={tick} /> },
    { id: 'btc' as WidgetId, node: <BTC tick={tick} /> },
    { id: 'stocks' as WidgetId, node: <Stocks tick={tick} /> },
    { id: 'news' as WidgetId, node: <NewsPL tick={tick} /> },
    { id: 'rss' as WidgetId, node: <RSS tick={tick} /> },
  ], [tick]);

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
          editMode={editMode}
          onToggleEdit={() => setEditMode(!editMode)}
          onResetLayout={resetLayout}
        />
        <SidebarInset>
          <DashboardHeader now={now} />
          <div className="p-6 max-sm:p-4">
            {loaded ? (
              <DashboardGrid
                widgets={widgets}
                layout={layout}
                editMode={editMode}
                onLayoutChange={onLayoutChange}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Ladowanie layoutu...</div>
            )}
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
