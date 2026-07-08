import { useState, useEffect, useCallback } from 'react';
import type { BreakpointLayouts } from '../types';
import { apiFetch } from '@/lib/api';

interface WidgetPrefData {
  enabled: boolean;
  savedLayout?: Record<string, unknown>;
}

type WidgetPrefs = Record<string, WidgetPrefData>;

interface DisableOptions {
  deleteData?: boolean;
  savedLayout?: Record<string, unknown>;
}

export function useWidgetPrefs() {
  const [prefs, setPrefs] = useState<WidgetPrefs>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/widget-prefs')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: WidgetPrefs) => { setPrefs(data); setLoaded(true); })
      .catch(err => { console.error('Failed to load widget prefs:', err); setLoaded(true); });
  }, []);

  const isEnabled = useCallback((widgetId: string): boolean => {
    const pref = prefs[widgetId];
    return pref === undefined || pref.enabled !== false;
  }, [prefs]);

  /** Re-enable widget. Returns saved layout per breakpoint if available. */
  const enableWidget = useCallback(async (widgetId: string): Promise<BreakpointLayouts | undefined> => {
    const prevPrefs = prefs;
    setPrefs(prev => { const next = { ...prev }; delete next[widgetId]; return next; });
    try {
      const data = await apiFetch<{ ok: boolean; savedLayout?: BreakpointLayouts }>(
        `/api/widget-prefs/${encodeURIComponent(widgetId)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: true }),
        },
      );
      return data.savedLayout;
    } catch (err) {
      console.error('Failed to enable widget:', err);
      setPrefs(prevPrefs); // rollback optimistic update — toggle wraca na poprzednia pozycje
      return undefined;
    }
  }, [prefs]);

  /** Disable widget, optionally saving its current layout per breakpoint. */
  const disableWidget = useCallback(async (widgetId: string, opts?: DisableOptions) => {
    const prevPrefs = prefs;
    setPrefs(prev => ({ ...prev, [widgetId]: { enabled: false } }));
    try {
      await apiFetch<{ ok: boolean }>(`/api/widget-prefs/${encodeURIComponent(widgetId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: false,
          deleteData: opts?.deleteData ?? false,
          savedLayout: opts?.savedLayout,
        }),
      });
    } catch (err) {
      console.error('Failed to disable widget:', err);
      setPrefs(prevPrefs); // rollback optimistic update — toggle wraca na poprzednia pozycje
    }
  }, [prefs]);

  return { prefs, loaded, isEnabled, enableWidget, disableWidget };
}
