import { useState, useEffect, useCallback, useRef } from 'react';
import type { LayoutItem, Breakpoint, BreakpointLayouts } from '../types';

const STATIC_LAYOUT: LayoutItem[] = [
  { i: 'weather',  x: 0, y: 0, w: 2, h: 4, minW: 2, maxW: 3, minH: 3 },
  { i: 'quote',    x: 2, y: 0, w: 1, h: 2, minW: 1, maxW: 2, minH: 2 },
  { i: 'calendar', x: 2, y: 2, w: 1, h: 4, minW: 1, maxW: 2, minH: 2 },
  { i: 'crypto',     x: 0, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
  { i: 'currencies', x: 1, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
  { i: 'stocks',     x: 2, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
];

function buildDefaultLayout(rssWidgetIds: string[]): LayoutItem[] {
  const rssItems: LayoutItem[] = rssWidgetIds.map((id, idx) => ({
    i: id, x: idx % 3, y: 8 + Math.floor(idx / 3) * 4, w: 1, h: 4, minW: 1, maxW: 3, minH: 3,
  }));
  return [...STATIC_LAYOUT, ...rssItems];
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
    return s ? { ...d, ...s } : d;
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

export function useLayout(rssWidgetIds: string[] = []) {
  const defaultLayout = buildDefaultLayout(rssWidgetIds);
  const defaultLayouts = deriveBreakpointDefaults(defaultLayout);
  const [layouts, setLayouts] = useState<BreakpointLayouts>(defaultLayouts);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const def = buildDefaultLayout(rssWidgetIds);
    const defBp = deriveBreakpointDefaults(def);
    fetch('/api/layout')
      .then(r => r.json())
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
      .catch(() => { setLayouts(defBp); setLoaded(true); });
  }, [rssWidgetIds.join(',')]);

  const saveLayouts = useCallback((newLayouts: BreakpointLayouts) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: newLayouts }),
      }).catch(() => { /* silent */ });
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
    const def = buildDefaultLayout(rssWidgetIds);
    const defBp = deriveBreakpointDefaults(def);
    setLayouts(defBp);
    saveLayouts(defBp);
  }, [saveLayouts, rssWidgetIds]);

  return { layouts, loaded, editMode, setEditMode, onLayoutChange, resetLayout };
}
