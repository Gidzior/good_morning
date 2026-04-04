import { useState, useEffect } from 'react';
import config from '../config';
import { formatTime, formatDayShort } from '../utils';
import type { CalendarEvent } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './Card';

interface DayGroup {
  label: string;
  events: CalendarEvent[];
}

export default function Calendar({ tick }: { tick: number }) {
  const [days, setDays] = useState<DayGroup[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const noKey = !config.GOOGLE_CALENDAR_API_KEY || config.GOOGLE_CALENDAR_API_KEY === 'TWOJ_KLUCZ_GOOGLE_CALENDAR';

  useEffect(() => {
    if (noKey) { setLoading(false); return; }

    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 3);

    fetch(`/api/calendar?apiKey=${config.GOOGLE_CALENDAR_API_KEY}&calendarId=${encodeURIComponent(config.GOOGLE_CALENDAR_ID)}&timeMin=${now.toISOString()}&timeMax=${end.toISOString()}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error.message);

        const events: CalendarEvent[] = data.items || [];
        const grouped: DayGroup[] = [];

        for (let i = 0; i < 3; i++) {
          const d = new Date(now);
          d.setDate(d.getDate() + i);
          const dayStr = d.toDateString();
          const label = i === 0 ? 'Dzis' : i === 1 ? 'Jutro' : formatDayShort(d);
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
  }, [tick, noKey]);

  return (
    <Card icon="📆" title="Kalendarz — najblizsze 3 dni" span={2}>
      {noKey ? (
        <div className="cal-empty">
          Uzupelnij GOOGLE_CALENDAR_API_KEY i GOOGLE_CALENDAR_ID w config.ts
        </div>
      ) : error ? (
        <ErrorMsg message={`Blad kalendarza: ${error}`} />
      ) : loading ? (
        <Loading text="Ladowanie kalendarza..." />
      ) : (
        days.map((day, i) => (
          <div className="cal-day" key={i}>
            <div className="cal-day-header">{day.label}</div>
            {day.events.length === 0 ? (
              <div className="cal-empty">Brak wydarzen</div>
            ) : (
              day.events.map((ev, j) => {
                let time = 'Caly dzien';
                if (ev.start.dateTime) {
                  time = `${formatTime(new Date(ev.start.dateTime))} - ${formatTime(new Date(ev.end.dateTime!))}`;
                }
                return (
                  <div className="cal-event" key={j}>
                    <span className="time">{time}</span>
                    <span className="title">{ev.summary || '(bez tytulu)'}</span>
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
