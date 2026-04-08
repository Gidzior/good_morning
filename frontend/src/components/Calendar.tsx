import { useState, useEffect } from 'react';
import { formatTime, formatDayShort } from '../utils';
import type { CalendarEvent } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './DashboardCard';

interface DayGroup {
  label: string;
  events: CalendarEvent[];
}

export default function Calendar({ tick }: { tick: number }) {
  const [days, setDays] = useState<DayGroup[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 3);

    fetch(`/api/calendar?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (data.error) {
          const msg = data.error as string;
          if (msg.includes('ustawien')) {
            setNoKey(true);
          } else {
            throw new Error(msg);
          }
          setLoading(false);
          return;
        }

        const events: CalendarEvent[] = data.items || [];
        const grouped: DayGroup[] = [];

        for (let i = 0; i < 3; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          const dayStr = d.toDateString();
          const label = i === 0 ? 'Dziś' : i === 1 ? 'Jutro' : formatDayShort(d);
          const dayEvents = events.filter(ev => {
            const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date!);
            return start.toDateString() === dayStr;
          });
          grouped.push({ label, events: dayEvents });
        }

        setDays(grouped);
        setLoading(false);
      })
      .catch(e => { console.error('Calendar fetch error:', e); setError(e instanceof Error ? e.message : 'Unknown error'); setLoading(false); });
  }, [tick]);

  return (
    <Card icon="📆" title="Kalendarz — najbliższe 3 dni">
      {noKey ? (
        <div className="cal-empty">
          Zaloguj się do kalendarza Google
        </div>
      ) : error ? (
        <ErrorMsg message={`Błąd kalendarza: ${error}`} />
      ) : loading ? (
        <Loading text="Ładowanie kalendarza..." />
      ) : (
        days.map((day, i) => (
          <div className="cal-day" key={i}>
            <div className="cal-day-header">{day.label}</div>
            {day.events.length === 0 ? (
              <div className="cal-empty">Brak wydarzeń</div>
            ) : (
              day.events.map((ev, j) => {
                let time = 'Cały dzień';
                if (ev.start.dateTime) {
                  time = `${formatTime(new Date(ev.start.dateTime))} - ${formatTime(new Date(ev.end.dateTime!))}`;
                }
                return (
                  <div
                    className="cal-event"
                    key={j}
                    style={ev.calendarColor ? { borderLeftColor: ev.calendarColor } : undefined}
                  >
                    <span className="time">{time}</span>
                    <span className="title">{ev.summary || '(bez tytułu)'}</span>
                  </div>
                );
              })
            )}
          </div>
        ))
      )}
    </Card>
  );
}
