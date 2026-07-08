import { useState, useEffect, useMemo, useCallback } from 'react';
import { REFRESH_INTERVAL } from './config';
import { useRefresh } from './hooks/useRefresh';
import { useLayout } from './hooks/useLayout';
import { useWidgetPrefs } from './hooks/useWidgetPrefs';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AppSidebar from './components/AppSidebar';
import DashboardHeader from './components/DashboardHeader';
import DashboardGrid from './components/DashboardGrid';
import LoginPage from './components/LoginPage';
import AccountPage from './components/AccountPage';
import Weather from './components/Weather';
import Calendar from './components/Calendar';
import TickerWidget from './components/TickerWidget';
import { CRYPTO_CONFIG, CURRENCIES_CONFIG, STOCKS_CONFIG } from './components/tickerConfigs';
import RSS from './components/RSS';
import type { RssFeedConfig } from './components/RSS';
import Quote from './components/Quote';
import TodoList from './components/TodoList';
import type { WidgetId } from './types';
import './App.css';

interface RssWidgetData {
  id: string;
  name: string;
  feeds: RssFeedConfig[];
}

interface TodoListData {
  id: string;
  name: string;
  google_tasklist_id: string | null;
}

type Page = 'dashboard' | 'account';

function Dashboard() {
  const { lastUpdate, countdown, refresh, tick } = useRefresh(REFRESH_INTERVAL);
  const [now, setNow] = useState(new Date());
  const [page, setPage] = useState<Page>('dashboard');
  const [rssWidgets, setRssWidgets] = useState<RssWidgetData[]>([]);
  const [rssLoaded, setRssLoaded] = useState(false);
  const [todoLists, setTodoLists] = useState<TodoListData[]>([]);
  const [todoLoaded, setTodoLoaded] = useState(false);
  const { loaded: prefsLoaded, isEnabled, enableWidget, disableWidget } = useWidgetPrefs();

  const loadRssWidgets = useCallback(() => {
    fetch('/api/rss-widgets')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: RssWidgetData[]) => { setRssWidgets(data); setRssLoaded(true); })
      .catch((err) => { console.error('Failed to load RSS widgets:', err); setRssLoaded(true); });
  }, []);

  const loadTodoLists = useCallback(() => {
    fetch('/api/todo-lists')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: TodoListData[]) => { setTodoLists(data); setTodoLoaded(true); })
      .catch((err) => { console.error('Failed to load todo lists:', err); setTodoLoaded(true); });
  }, []);

  useEffect(() => { loadRssWidgets(); }, [loadRssWidgets]);
  useEffect(() => { loadTodoLists(); }, [loadTodoLists]);

  const rssWidgetIds = useMemo(() => rssWidgets.map(w => `rss-${w.id}` as const), [rssWidgets]);
  const todosWidgetIds = useMemo<WidgetId[]>(() => todoLists.length > 0 ? ['todos'] : [], [todoLists]);
  const dynamicWidgetIds = useMemo(() => [...todosWidgetIds, ...rssWidgetIds], [todosWidgetIds, rssWidgetIds]);
  const { layouts, loaded, editMode, setEditMode, onLayoutChange, resetLayout, restoreWidgetLayout, getWidgetLayout } = useLayout(dynamicWidgetIds);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const [rssDialogOpen, setRssDialogOpen] = useState(false);
  const [rssName, setRssName] = useState('');
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  const [todoName, setTodoName] = useState('');

  const addRssWidget = useCallback(async (name: string) => {
    if (!name.trim()) return;
    const r = await fetch('/api/rss-widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!r.ok) { console.error('Failed to add RSS widget:', r.status); return; }
    loadRssWidgets();
  }, [loadRssWidgets]);

  const addTodoList = useCallback(async (name: string) => {
    if (!name.trim()) return;
    const r = await fetch('/api/todo-lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!r.ok) { console.error('Failed to add todo list:', r.status); return; }
    loadTodoLists();
  }, [loadTodoLists]);

  const deleteTodoList = useCallback(async (id: string) => {
    const r = await fetch(`/api/todo-lists/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) { console.error('Failed to delete todo list:', r.status); return; }
    loadTodoLists();
  }, [loadTodoLists]);

  const handleDisableWidget = useCallback(async (widgetId: string, deleteData: boolean) => {
    // Save widget's current layout before disabling
    const widgetLayout = getWidgetLayout(widgetId);
    await disableWidget(widgetId, { deleteData, savedLayout: widgetLayout });
    // If dynamic widget was hard-deleted, reload the list
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
      { id: 'crypto' as WidgetId, node: <TickerWidget config={CRYPTO_CONFIG} tick={tick} /> },
      { id: 'currencies' as WidgetId, node: <TickerWidget config={CURRENCIES_CONFIG} tick={tick} /> },
      { id: 'stocks' as WidgetId, node: <TickerWidget config={STOCKS_CONFIG} tick={tick} /> },
    ];
    const todoEntries = todoLists.length > 0
      ? [{
          id: 'todos' as WidgetId,
          node: (
            <TodoList
              lists={todoLists.map(t => ({ id: t.id, name: t.name }))}
              tick={tick}
              onDeleteList={deleteTodoList}
            />
          ),
        }]
      : [];
    const rssEntries = rssWidgets.map(w => ({
      id: `rss-${w.id}` as WidgetId,
      node: <RSS key={w.id} widgetId={w.id} widgetName={w.name} feeds={w.feeds} tick={tick} onFeedsChanged={loadRssWidgets} />,
    }));
    return [...staticWidgets, ...todoEntries, ...rssEntries];
  }, [tick, todoLists, rssWidgets, loadRssWidgets, deleteTodoList]);

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
          onAddRss={() => { setRssName(''); setRssDialogOpen(true); }}
          onAddTodo={() => { setTodoName(''); setTodoDialogOpen(true); }}
          onDeleteTodoList={deleteTodoList}
          rssWidgets={rssWidgets.map(w => ({ id: w.id, name: w.name }))}
          todoWidgets={todoLists.map(t => ({ id: t.id, name: t.name }))}
          isWidgetEnabled={isEnabled}
          onEnableWidget={handleEnableWidget}
          onDisableWidget={handleDisableWidget}
        />
        <SidebarInset>
          <DashboardHeader now={now} tick={tick} onAccount={() => setPage('account')} />
          <div className="p-6 max-sm:p-0">
            {loaded && rssLoaded && todoLoaded && prefsLoaded ? (
              <DashboardGrid
                widgets={visibleWidgets}
                layouts={layouts}
                editMode={editMode}
                onLayoutChange={onLayoutChange}
              />
            ) : (
              <div className="text-sm text-muted-foreground">Ładowanie layoutu...</div>
            )}
          </div>
        </SidebarInset>
        <Dialog open={rssDialogOpen} onOpenChange={setRssDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Nowy widget RSS</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Nazwa widgetu"
              value={rssName}
              onChange={(e) => setRssName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && rssName.trim()) {
                  addRssWidget(rssName);
                  setRssDialogOpen(false);
                }
              }}
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRssDialogOpen(false)}>Anuluj</Button>
              <Button
                disabled={!rssName.trim()}
                onClick={() => { addRssWidget(rssName); setRssDialogOpen(false); }}
              >
                Dodaj
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={todoDialogOpen} onOpenChange={setTodoDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Nowa lista zadań</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Nazwa listy"
              value={todoName}
              onChange={(e) => setTodoName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && todoName.trim()) {
                  addTodoList(todoName);
                  setTodoDialogOpen(false);
                }
              }}
              autoFocus
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setTodoDialogOpen(false)}>Anuluj</Button>
              <Button
                disabled={!todoName.trim()}
                onClick={() => { addTodoList(todoName); setTodoDialogOpen(false); }}
              >
                Dodaj
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          <div className="text-sm text-muted-foreground">Ładowanie...</div>
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
