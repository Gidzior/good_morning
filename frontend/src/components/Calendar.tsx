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
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          if (data.error.message?.includes('.env')) {
            setNoKey(true);
          } else {
            throw new Error(data.error.message);
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
      .catch(e => { setError(e.message); setLoading(false); });
  }, [tick]);

  return (
    <Card icon="📆" title="Kalendarz — najbliższe 3 dni" span={2}>
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
