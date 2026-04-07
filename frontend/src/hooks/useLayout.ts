import { useState, useEffect, useCallback, useRef } from 'react';
import type { LayoutItem } from '../types';

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

export function useLayout(rssWidgetIds: string[] = []) {
  const defaultLayout = buildDefaultLayout(rssWidgetIds);
  const [layout, setLayout] = useState<LayoutItem[]>(defaultLayout);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load layout from backend (re-run when rssWidgetIds change)
  useEffect(() => {
    const def = buildDefaultLayout(rssWidgetIds);
    fetch('/api/layout')
      .then(r => r.json())
      .then((data: { layout: LayoutItem[] | null }) => {
        if (data.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          const savedMap = new Map(data.layout.map(item => [item.i, item]));
          const merged = def.map(d => {
            const saved = savedMap.get(d.i);
            return saved ? { ...d, ...saved } : d;
          });
          setLayout(merged);
        } else {
          setLayout(def);
        }
        setLoaded(true);
      })
      .catch(() => { setLayout(def); setLoaded(true); });
  }, [rssWidgetIds.join(',')]);

  // Debounced save to backend
  const saveLayout = useCallback((newLayout: LayoutItem[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: newLayout }),
      }).catch(() => { /* silent */ });
    }, 800);
  }, []);

  const onLayoutChange = useCallback((newLayout: LayoutItem[]) => {
    setLayout(newLayout);
    saveLayout(newLayout);
  }, [saveLayout]);

  const resetLayout = useCallback(() => {
    const def = buildDefaultLayout(rssWidgetIds);
    setLayout(def);
    saveLayout(def);
  }, [saveLayout, rssWidgetIds]);

  return { layout, loaded, editMode, setEditMode, onLayoutChange, resetLayout };
}
