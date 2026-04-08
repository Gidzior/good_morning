import { useState, useEffect, useMemo, useCallback } from 'react';
import config from './config';
import { useRefresh } from './hooks/useRefresh';
import { useLayout } from './hooks/useLayout';
import { useWidgetPrefs } from './hooks/useWidgetPrefs';
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
import Crypto from './components/Crypto';
import Currencies from './components/Currencies';
import Stocks from './components/Stocks';
import RSS from './components/RSS';
import type { RssFeedConfig } from './components/RSS';
import Quote from './components/Quote';
import type { WidgetId } from './types';
import './App.css';

interface RssWidgetData {
  id: string;
  name: string;
  feeds: RssFeedConfig[];
}

type Page = 'dashboard' | 'account';

function Dashboard() {
  const { lastUpdate, countdown, refresh, tick } = useRefresh(config.REFRESH_INTERVAL);
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState<Page>('dashboard');
  const [rssWidgets, setRssWidgets] = useState<RssWidgetData[]>([]);
  const [rssLoaded, setRssLoaded] = useState(false);
  const { loaded: prefsLoaded, isEnabled, enableWidget, disableWidget } = useWidgetPrefs();

  const loadRssWidgets = useCallback(() => {
    fetch('/api/rss-widgets')
      .then(r => r.json())
      .then((data: RssWidgetData[]) => { setRssWidgets(data); setRssLoaded(true); })
      .catch(() => setRssLoaded(true));
  }, []);

  useEffect(() => { loadRssWidgets(); }, [loadRssWidgets]);

  const rssWidgetIds = useMemo(() => rssWidgets.map(w => `rss-${w.id}` as const), [rssWidgets]);
  const { layouts, loaded, editMode, setEditMode, onLayoutChange, resetLayout, restoreWidgetLayout, getWidgetLayout } = useLayout(rssWidgetIds);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const addRssWidget = useCallback(async () => {
    const name = prompt('Nazwa widgetu RSS:');
    if (!name) return;
    await fetch('/api/rss-widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    loadRssWidgets();
  }, [loadRssWidgets]);

  const handleDisableWidget = useCallback(async (widgetId: string, deleteData: boolean) => {
    // Save widget's current layout before disabling
    const widgetLayout = getWidgetLayout(widgetId);
    await disableWidget(widgetId, { deleteData, savedLayout: widgetLayout });
    // If RSS widget was hard-deleted, reload the list
    if (deleteData && widgetId.startsWith('rss-')) {
      loadRssWidgets();
    }
  }, [disableWidget, loadRssWidgets, getWidgetLayout]);

  const handleEnableWidget = useCallback(async (widgetId: string) => {
    const savedLayout = await enableWidget(widgetId);
    // Restore saved layout dimensions if available
    if (savedLayout) {
      restoreWidgetLayout(savedLayout);
    }
  }, [enableWidget, restoreWidgetLayout]);

  const allWidgets = useMemo(() => {
    const staticWidgets = [
      { id: 'weather' as WidgetId, node: <Weather tick={tick} /> },
      { id: 'quote' as WidgetId, node: <Quote tick={tick} /> },
      { id: 'calendar' as WidgetId, node: <Calendar tick={tick} /> },
      { id: 'crypto' as WidgetId, node: <Crypto tick={tick} /> },
      { id: 'currencies' as WidgetId, node: <Currencies tick={tick} /> },
      { id: 'stocks' as WidgetId, node: <Stocks tick={tick} /> },
    ];
    const rssEntries = rssWidgets.map(w => ({
      id: `rss-${w.id}` as WidgetId,
      node: <RSS key={w.id} widgetId={w.id} widgetName={w.name} feeds={w.feeds} tick={tick} onFeedsChanged={loadRssWidgets} />,
    }));
    return [...staticWidgets, ...rssEntries];
  }, [tick, rssWidgets, loadRssWidgets]);

  // Filter to only enabled widgets
  const visibleWidgets = useMemo(
    () => allWidgets.filter(w => isEnabled(w.id)),
    [allWidgets, isEnabled],
  );

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
          onAddRss={addRssWidget}
          rssWidgets={rssWidgets.map(w => ({ id: w.id, name: w.name }))}
          isWidgetEnabled={isEnabled}
          onEnableWidget={handleEnableWidget}
          onDisableWidget={handleDisableWidget}
        />
        <SidebarInset>
          <DashboardHeader now={now} />
          <div className="p-6 max-sm:p-4">
            {loaded && rssLoaded && prefsLoaded ? (
              <DashboardGrid
                widgets={visibleWidgets}
                layouts={layouts}
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
