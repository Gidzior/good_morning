import { useState, useEffect, useCallback } from 'react';
import type { BreakpointLayouts } from '../types';

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
    setPrefs(prev => { const next = { ...prev }; delete next[widgetId]; return next; });
    const r = await fetch(`/api/widget-prefs/${encodeURIComponent(widgetId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true }),
    });
    const data = await r.json() as { savedLayout?: BreakpointLayouts };
    return data.savedLayout;
  }, []);

  /** Disable widget, optionally saving its current layout per breakpoint. */
  const disableWidget = useCallback(async (widgetId: string, opts?: DisableOptions) => {
    setPrefs(prev => ({ ...prev, [widgetId]: { enabled: false } }));
    await fetch(`/api/widget-prefs/${encodeURIComponent(widgetId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
        deleteData: opts?.deleteData ?? false,
        savedLayout: opts?.savedLayout,
      }),
    });
  }, []);

  return { prefs, loaded, isEnabled, enableWidget, disableWidget };
}
