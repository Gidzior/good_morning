import { useState, useEffect } from 'react';
import { formatTime, formatDayHeader } from '../utils';
import type { CalendarEvent } from '../types';
import Loading, { ErrorMsg } from './Loading';
import Card from './DashboardCard';
import { CalendarIcon } from 'lucide-react';

type EventStatus = 'past' | 'current' | 'future';

interface DayGroup {
  label: string;
  allDay: CalendarEvent[];
  timed: CalendarEvent[];
  isToday: boolean;
}

function isAllDay(ev: CalendarEvent): boolean {
  return !ev.start.dateTime && !!ev.start.date;
}

function eventStatus(ev: CalendarEvent, now: Date): EventStatus {
  if (!ev.start.dateTime || !ev.end.dateTime) return 'future';
  const start = new Date(ev.start.dateTime);
  const end = new Date(ev.end.dateTime);
  if (end <= now) return 'past';
  if (start <= now && now < end) return 'current';
  return 'future';
}

function pluralEvents(n: number): string {
  if (n === 1) return '1 wydarzenie dziś';
  const last = n % 10;
  const lastTwo = n % 100;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} wydarzenia dziś`;
  return `${n} wydarzeń dziś`;
}

export default function Calendar({ tick }: { tick: number }) {
  const [days, setDays] = useState<DayGroup[]>([]);
  const [todayCount, setTodayCount] = useState(0);
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
          const dayEvents = events.filter(ev => {
            const start = ev.start.dateTime ? new Date(ev.start.dateTime) : new Date(ev.start.date!);
            return start.toDateString() === dayStr;
          });
          grouped.push({
            label: formatDayHeader(d, i),
            allDay: dayEvents.filter(isAllDay),
            timed: dayEvents.filter(ev => !isAllDay(ev)),
            isToday: i === 0,
          });
        }

        setDays(grouped);
        setTodayCount(grouped[0] ? grouped[0].allDay.length + grouped[0].timed.length : 0);
        setLoading(false);
      })
      .catch(e => { console.error('Calendar fetch error:', e); setError(e instanceof Error ? e.message : 'Unknown error'); setLoading(false); });
  }, [tick]);

  const countLabel = !loading && !error && !noKey
    ? <span className="cal-count">{pluralEvents(todayCount)}</span>
    : undefined;

  return (
    <Card icon={<CalendarIcon />} title="Kalendarz" action={countLabel}>
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
            {day.allDay.map((ev, j) => (
              <div className="cal-allday-pill" key={`a${j}`}>
                {ev.summary || '(bez tytułu)'}
              </div>
            ))}
            {day.allDay.length === 0 && day.timed.length === 0 ? (
              <div className="cal-empty">Brak wydarzeń</div>
            ) : (
              day.timed.map((ev, j) => {
                const status = day.isToday ? eventStatus(ev, new Date()) : 'future';
                const time = `${formatTime(new Date(ev.start.dateTime!))} - ${formatTime(new Date(ev.end.dateTime!))}`;
                const color = ev.calendarColor;
                const style: React.CSSProperties = {};
                if (color) {
                  style.borderLeftColor = color;
                  if (status === 'current') {
                    style.background = `color-mix(in srgb, ${color} 15%, var(--secondary))`;
                  }
                }
                return (
                  <div
                    className={`cal-event cal-event-${status}`}
                    key={j}
                    style={style}
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
