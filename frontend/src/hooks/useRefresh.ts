import { useState, useEffect, useCallback, useRef } from 'react';

export function useRefresh(intervalMs: number) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState('');
  const [tick, setTick] = useState(0);
  // 0 = uninitialized; deadline is set in the effect (Date.now() is impure during render)
  const nextRef = useRef(0);

  const refresh = useCallback(() => {
    setLastUpdate(new Date());
    nextRef.current = Date.now() + intervalMs;
    setTick(t => t + 1);
  }, [intervalMs]);

  useEffect(() => {
    if (nextRef.current === 0) nextRef.current = Date.now() + intervalMs;
    const id = setInterval(() => {
      const diff = nextRef.current - Date.now();
      if (diff <= 0) {
        refresh();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}min`);
    }, 60000);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { lastUpdate, countdown, refresh, tick };
}
