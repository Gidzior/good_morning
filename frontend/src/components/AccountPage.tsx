import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiFetch, ApiError } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import Loading from './Loading';
import { CalendarIcon, LogOutIcon, LinkIcon, UnlinkIcon, ArrowLeftIcon, CheckIcon } from 'lucide-react';

interface GoogleCalendar {
  id: string;
  summary: string;
  primary: boolean;
  backgroundColor: string;
}

interface CalendarPref {
  calendar_id: string;
  calendar_name: string;
  enabled: number;
}

interface AccountPageProps {
  onBack: () => void;
  lastUpdate: Date;
  countdown: string;
  onRefresh: () => void;
}

export default function AccountPage({ onBack, lastUpdate, countdown, onRefresh }: AccountPageProps) {
  const { user, logout, refresh } = useAuth();
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set());
  const [loadingCals, setLoadingCals] = useState(false);
  const [calsError, setCalsError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchCalendars = useCallback(async () => {
    setLoadingCals(true);
    setCalsError(null);
    try {
      const data = await apiFetch<{ calendars: GoogleCalendar[]; prefs: CalendarPref[] }>('/api/calendars');
      setCalendars(data.calendars);

      if (data.prefs.length > 0) {
        setEnabledIds(new Set(data.prefs.filter(p => p.enabled).map(p => p.calendar_id)));
      } else {
        // Default: enable primary calendar
        const primary = data.calendars.find(c => c.primary);
        setEnabledIds(new Set(primary ? [primary.id] : []));
      }
    } catch (err) {
      console.error('Failed to fetch calendars:', err);
      if (err instanceof ApiError && err.status === 403) {
        // has_calendar bylo stale-true, a tokeny Google znikly — odswiez stan auth, sekcja sie schowa
        await refresh();
      } else {
        setCalsError('Nie udało się pobrać listy kalendarzy');
      }
    } finally {
      setLoadingCals(false);
    }
  }, [refresh]);

  useEffect(() => {
    if (user?.has_calendar) {
      fetchCalendars();
    }
  }, [user?.has_calendar, fetchCalendars]);

  if (!user) return null;

  const handleDisconnectCalendar = async () => {
    const r = await fetch('/auth/disconnect-calendar', { method: 'POST' });
    if (!r.ok) { console.error('Failed to disconnect calendar:', r.status); return; }
    await refresh();
    setCalendars([]);
    setEnabledIds(new Set());
  };

  const toggleCalendar = (id: string) => {
    setEnabledIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setSaved(false);
  };

  const savePrefs = async () => {
    setSaving(true);
    const prefs = calendars.map(c => ({
      calendar_id: c.id,
      calendar_name: c.summary,
      enabled: enabledIds.has(c.id),
    }));
    const r = await fetch('/api/calendars/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs }),
    });
    setSaving(false);
    if (!r.ok) { console.error('Failed to save calendar prefs:', r.status); return; }
    setSaved(true);
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar lastUpdate={lastUpdate} countdown={countdown} onRefresh={onRefresh} />
        <SidebarInset>
          <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <SidebarTrigger />
            <Separator orientation="vertical" />
            <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
              <ArrowLeftIcon className="h-4 w-4" />
              Powrot
            </Button>
            <h1 className="text-sm font-semibold text-foreground">Ustawienia konta</h1>
          </header>

          <div className="mx-auto max-w-2xl p-6">
            {/* Profile card */}
            <Card className="mb-6 border-border">
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Profil</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt=""
                    className="h-16 w-16 rounded-full"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl text-primary-foreground">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-lg font-semibold text-foreground">{user.name}</span>
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                </div>
              </CardContent>
            </Card>

            {/* Calendar connection */}
            <Card className="mb-6 border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarIcon className="h-4 w-4" />
                  Google Calendar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {user.has_calendar ? (
                      <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600">
                        <LinkIcon className="h-3 w-3" />
                        Polaczony
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <UnlinkIcon className="h-3 w-3" />
                        Nie połączony
                      </Badge>
                    )}
                  </div>
                  {user.has_calendar ? (
                    <Button variant="outline" size="sm" className="gap-2" onClick={handleDisconnectCalendar}>
                      <UnlinkIcon className="h-3.5 w-3.5" />
                      Odlacz
                    </Button>
                  ) : (
                    <a
                      href="/auth/calendar-connect"
                      className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-2' })}
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      Polacz kalendarz
                    </a>
                  )}
                </div>

                {/* Calendar selection */}
                {user.has_calendar && (
                  <div className="mt-4 border-t border-border pt-4">
                    <div className="mb-3 text-xs font-medium text-muted-foreground">
                      Wybierz kalendarze do wyswietlania
                    </div>
                    {loadingCals ? (
                      <Loading text="Ładowanie kalendarzy..." />
                    ) : calsError ? (
                      <div className="text-xs text-destructive">{calsError}</div>
                    ) : calendars.length === 0 ? (
                      <div className="text-xs text-muted-foreground">Brak kalendarzy</div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1.5">
                          {calendars.map(cal => (
                            <button
                              key={cal.id}
                              onClick={() => toggleCalendar(cal.id)}
                              className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                            >
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border"
                                style={{
                                  backgroundColor: enabledIds.has(cal.id) ? cal.backgroundColor : 'transparent',
                                  borderColor: cal.backgroundColor,
                                }}
                              >
                                {enabledIds.has(cal.id) && (
                                  <CheckIcon className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <span className="flex-1 truncate text-foreground">
                                {cal.summary}
                                {cal.primary && (
                                  <span className="ml-1.5 text-[10px] text-muted-foreground">(glowny)</span>
                                )}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={savePrefs}
                            disabled={saving}
                          >
                            {saving ? 'Zapisywanie...' : 'Zapisz'}
                          </Button>
                          {saved && (
                            <span className="text-xs text-emerald-600">Zapisano</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Logout */}
            <Card className="border-border">
              <CardContent className="pt-6">
                <Button variant="outline" className="gap-2 text-destructive hover:bg-destructive/10" onClick={logout}>
                  <LogOutIcon className="h-4 w-4" />
                  Wyloguj się
                </Button>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
