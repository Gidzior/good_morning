import { useState, useEffect, useCallback, useRef } from 'react';
import type { LayoutItem } from '../types';

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'weather',  x: 0, y: 0, w: 2, h: 4, minW: 2, maxW: 3, minH: 3 },
  { i: 'quote',    x: 2, y: 0, w: 1, h: 2, minW: 1, maxW: 2, minH: 2 },
  { i: 'calendar', x: 2, y: 2, w: 1, h: 4, minW: 1, maxW: 2, minH: 2 },
  { i: 'btc',      x: 0, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
  { i: 'stocks',   x: 1, y: 4, w: 1, h: 3, minW: 1, maxW: 3, minH: 2 },
  { i: 'news',     x: 0, y: 7, w: 2, h: 4, minW: 1, maxW: 3, minH: 3 },
  { i: 'rss',      x: 2, y: 7, w: 1, h: 4, minW: 1, maxW: 3, minH: 3 },
];

export function useLayout() {
  const [layout, setLayout] = useState<LayoutItem[]>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load layout from backend
  useEffect(() => {
    fetch('/api/layout')
      .then(r => r.json())
      .then((data: { layout: LayoutItem[] | null }) => {
        if (data.layout && Array.isArray(data.layout) && data.layout.length > 0) {
          // Merge saved layout with defaults (in case new widgets were added)
          const savedMap = new Map(data.layout.map(item => [item.i, item]));
          const merged = DEFAULT_LAYOUT.map(def => {
            const saved = savedMap.get(def.i);
            return saved ? { ...def, ...saved } : def;
          });
          setLayout(merged);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

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
    setLayout(DEFAULT_LAYOUT);
    saveLayout(DEFAULT_LAYOUT);
  }, [saveLayout]);

  return { layout, loaded, editMode, setEditMode, onLayoutChange, resetLayout };
}
