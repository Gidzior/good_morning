import { useState, useEffect, useMemo, useCallback } from 'react';
import { REFRESH_INTERVAL } from './config';
import { useRefresh } from './hooks/useRefresh';
import { useLayout } from './hooks/useLayout';
import { useWidgetPrefs } from './hooks/useWidgetPrefs';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { apiFetch } from '@/lib/api';
import { ErrorMsg } from './components/Loading';
import { NameDialog } from './components/NameDialog';
import ConfirmDialog from './components/ConfirmDialog';
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
  const [todoDialogOpen, setTodoDialogOpen] = useState(false);
  // Cel dialogu potwierdzenia usuniecia listy zadan (sidebar + widget TodoList)
  const [deleteListTarget, setDeleteListTarget] = useState<{ id: string; name: string } | null>(null);
  // Blad mutacji w otwartym dialogu dodawania (RSS/todo) — czyszczony przy otwarciu i zmianie nazwy
  const [dialogError, setDialogError] = useState<string | null>(null);
  // Blad mutacji spoza dialogow dodawania (np. usuwanie listy zadan) — czyszczony przy nowej probie
  const [actionError, setActionError] = useState<string | null>(null);
  // Guard in-flight dla dialogow dodawania — naraz otwarty jest jeden, wspolny stan wystarcza
  const [dialogSubmitting, setDialogSubmitting] = useState(false);

  const addRssWidget = useCallback(async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    setDialogError(null);
    try {
      await apiFetch<unknown>('/api/rss-widgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      loadRssWidgets();
      return true;
    } catch (err) {
      console.error('Failed to add RSS widget:', err);
      setDialogError(`Nie udało się dodać widgetu RSS: ${err instanceof Error ? err.message : 'nieznany błąd'}`);
      return false;
    }
  }, [loadRssWidgets]);

  const addTodoList = useCallback(async (name: string): Promise<boolean> => {
    if (!name.trim()) return false;
    setDialogError(null);
    try {
      await apiFetch<unknown>('/api/todo-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      loadTodoLists();
      return true;
    } catch (err) {
      console.error('Failed to add todo list:', err);
      setDialogError(`Nie udało się dodać listy zadań: ${err instanceof Error ? err.message : 'nieznany błąd'}`);
      return false;
    }
  }, [loadTodoLists]);

  const deleteTodoList = useCallback(async (id: string) => {
    setActionError(null);
    try {
      await apiFetch<{ ok: boolean }>(`/api/todo-lists/${encodeURIComponent(id)}`, { method: 'DELETE' });
      loadTodoLists();
    } catch (err) {
      console.error('Failed to delete todo list:', err);
      setActionError(`Nie udało się usunąć listy zadań: ${err instanceof Error ? err.message : 'nieznany błąd'}`);
    }
  }, [loadTodoLists]);

  const submitRssDialog = useCallback(async (name: string) => {
    if (dialogSubmitting || !name.trim()) return;
    setDialogSubmitting(true);
    try {
      const ok = await addRssWidget(name);
      if (ok) setRssDialogOpen(false);
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogSubmitting, addRssWidget]);

  const submitTodoDialog = useCallback(async (name: string) => {
    if (dialogSubmitting || !name.trim()) return;
    setDialogSubmitting(true);
    try {
      const ok = await addTodoList(name);
      if (ok) setTodoDialogOpen(false);
    } finally {
      setDialogSubmitting(false);
    }
  }, [dialogSubmitting, addTodoList]);

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
              onRequestDeleteList={setDeleteListTarget}
            />
          ),
        }]
      : [];
    const rssEntries = rssWidgets.map(w => ({
      id: `rss-${w.id}` as WidgetId,
      node: <RSS key={w.id} widgetId={w.id} widgetName={w.name} feeds={w.feeds} tick={tick} onFeedsChanged={loadRssWidgets} />,
    }));
    return [...staticWidgets, ...todoEntries, ...rssEntries];
  }, [tick, todoLists, rssWidgets, loadRssWidgets]);

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
          onAddRss={() => { setDialogError(null); setRssDialogOpen(true); }}
          onAddTodo={() => { setDialogError(null); setTodoDialogOpen(true); }}
          onRequestDeleteList={setDeleteListTarget}
          rssWidgets={rssWidgets.map(w => ({ id: w.id, name: w.name }))}
          todoWidgets={todoLists.map(t => ({ id: t.id, name: t.name }))}
          isWidgetEnabled={isEnabled}
          onEnableWidget={handleEnableWidget}
          onDisableWidget={handleDisableWidget}
        />
        <SidebarInset>
          <DashboardHeader now={now} tick={tick} onAccount={() => setPage('account')} />
          <div className="p-6 max-sm:p-0">
            {actionError && <div className="mb-3"><ErrorMsg message={actionError} /></div>}
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
        <NameDialog
          open={rssDialogOpen}
          title="Nowy widget RSS"
          placeholder="Nazwa widgetu"
          submitting={dialogSubmitting}
          error={dialogError}
          onSubmit={(name) => void submitRssDialog(name)}
          onClose={() => setRssDialogOpen(false)}
        />
        <NameDialog
          open={todoDialogOpen}
          title="Nowa lista zadań"
          placeholder="Nazwa listy"
          submitting={dialogSubmitting}
          error={dialogError}
          onSubmit={(name) => void submitTodoDialog(name)}
          onClose={() => setTodoDialogOpen(false)}
        />
        <ConfirmDialog
          open={deleteListTarget !== null}
          title="Usuń listę zadań"
          description={`Lista "${deleteListTarget?.name ?? ''}" wraz z wszystkimi zadaniami zostanie trwale usunięta z Google Tasks.`}
          confirmLabel="Usuń listę"
          onConfirm={async () => {
            if (deleteListTarget) {
              await deleteTodoList(deleteListTarget.id);
            }
            setDeleteListTarget(null);
          }}
          onCancel={() => setDeleteListTarget(null)}
        />
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
