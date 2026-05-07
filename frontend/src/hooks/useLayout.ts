import { useState, useEffect, useCallback, useRef } from 'react';
import type { LayoutItem, Breakpoint, BreakpointLayouts } from '../types';

const STATIC_LAYOUT: LayoutItem[] = [
  { i: 'weather',  x: 0, y: 0, w: 2, h: 4, minW: 1, maxW: 3, minH: 3 },
  { i: 'quote',    x: 2, y: 0, w: 1, h: 2, minW: 1, maxW: 2, minH: 2 },
  { i: 'calendar', x: 2, y: 2, w: 1, h: 4, minW: 1, maxW: 2, minH: 2 },
  { i: 'crypto',     x: 0, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
  { i: 'currencies', x: 1, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
  { i: 'stocks',     x: 2, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
];

function buildDefaultLayout(dynamicWidgetIds: string[]): LayoutItem[] {
  const dynamicItems: LayoutItem[] = dynamicWidgetIds.map((id, idx) => ({
    i: id, x: idx % 3, y: 7 + Math.floor(idx / 3) * 4, w: 1, h: 4, minW: 1, maxW: 3, minH: 3,
  }));
  return [...STATIC_LAYOUT, ...dynamicItems];
}

function deriveBreakpointDefaults(lg: LayoutItem[]): BreakpointLayouts {
  return {
    lg,
    md: lg.map(l => ({ ...l, w: Math.min(l.w, 2) })),
    sm: lg.map(l => ({ ...l, w: 1, x: 0 })),
  };
}

function mergeWithDefaults(defaults: LayoutItem[], saved: LayoutItem[]): LayoutItem[] {
  const savedMap = new Map(saved.map(item => [item.i, item]));
  return defaults.map(d => {
    const s = savedMap.get(d.i);
    if (!s) return d;
    // Saved provides position/size (x, y, w, h); defaults always supply current
    // constraints (minW, maxW, minH) so updates propagate to existing users.
    return { ...s, minW: d.minW, maxW: d.maxW, minH: d.minH };
  });
}

interface SavedLayouts {
  lg?: LayoutItem[];
  md?: LayoutItem[];
  sm?: LayoutItem[];
}

function isSavedLayouts(data: unknown): data is SavedLayouts {
  return typeof data === 'object' && data !== null && !Array.isArray(data) && 'lg' in data;
}

export function useLayout(dynamicWidgetIds: string[] = []) {
  const defaultLayout = buildDefaultLayout(dynamicWidgetIds);
  const defaultLayouts = deriveBreakpointDefaults(defaultLayout);
  const [layouts, setLayouts] = useState<BreakpointLayouts>(defaultLayouts);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const def = buildDefaultLayout(dynamicWidgetIds);
    const defBp = deriveBreakpointDefaults(def);
    fetch('/api/layout')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: { layout: unknown }) => {
        if (!data.layout) {
          setLayouts(defBp);
          setLoaded(true);
          return;
        }

        if (isSavedLayouts(data.layout)) {
          // New format: per-breakpoint layouts
          const merged: BreakpointLayouts = {
            lg: mergeWithDefaults(defBp.lg, data.layout.lg ?? []),
            md: mergeWithDefaults(defBp.md, data.layout.md ?? []),
            sm: mergeWithDefaults(defBp.sm, data.layout.sm ?? []),
          };
          setLayouts(merged);
        } else if (Array.isArray(data.layout) && data.layout.length > 0) {
          // Legacy format: single LayoutItem[] — treat as lg, derive others
          const lgMerged = mergeWithDefaults(def, data.layout as LayoutItem[]);
          setLayouts(deriveBreakpointDefaults(lgMerged));
        } else {
          setLayouts(defBp);
        }
        setLoaded(true);
      })
      .catch((err) => { console.error('Failed to load layout:', err); setLayouts(defBp); setLoaded(true); });
  }, [dynamicWidgetIds.join(',')]);

  const saveLayouts = useCallback((newLayouts: BreakpointLayouts) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: newLayouts }),
      }).catch((err) => { console.error('Failed to save layout:', err); });
    }, 800);
  }, []);

  const onLayoutChange = useCallback((breakpoint: Breakpoint, newLayout: LayoutItem[]) => {
    setLayouts(prev => {
      const updated = { ...prev, [breakpoint]: newLayout };
      saveLayouts(updated);
      return updated;
    });
  }, [saveLayouts]);

  const resetLayout = useCallback(() => {
    const def = buildDefaultLayout(dynamicWidgetIds);
    const defBp = deriveBreakpointDefaults(def);
    setLayouts(defBp);
    saveLayouts(defBp);
  }, [saveLayouts, dynamicWidgetIds]);

  /** Merge saved per-breakpoint layout for a widget back into layouts */
  const restoreWidgetLayout = useCallback((saved: BreakpointLayouts) => {
    setLayouts(prev => {
      const updated = { ...prev };
      for (const bp of ['lg', 'md', 'sm'] as Breakpoint[]) {
        const items = saved[bp];
        if (!items?.length) continue;
        const savedMap = new Map(items.map(l => [l.i, l]));
        updated[bp] = prev[bp].map(l => {
          const s = savedMap.get(l.i);
          return s ? { ...l, ...s } : l;
        });
      }
      saveLayouts(updated);
      return updated;
    });
  }, [saveLayouts]);

  /** Extract a single widget's layout from all breakpoints */
  const getWidgetLayout = useCallback((widgetId: string): BreakpointLayouts => {
    return {
      lg: layouts.lg.filter(l => l.i === widgetId),
      md: layouts.md.filter(l => l.i === widgetId),
      sm: layouts.sm.filter(l => l.i === widgetId),
    };
  }, [layouts]);

  return { layouts, loaded, editMode, setEditMode, onLayoutChange, resetLayout, restoreWidgetLayout, getWidgetLayout };
}
