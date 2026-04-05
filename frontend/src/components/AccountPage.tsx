import { useAuth } from '../hooks/useAuth';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from './AppSidebar';
import { CalendarIcon, LogOutIcon, LinkIcon, UnlinkIcon, ArrowLeftIcon } from 'lucide-react';

interface AccountPageProps {
  onBack: () => void;
  lastUpdate: Date;
  countdown: string;
  onRefresh: () => void;
}

export default function AccountPage({ onBack, lastUpdate, countdown, onRefresh }: AccountPageProps) {
  const { user, logout, refresh } = useAuth();

  if (!user) return null;

  const handleDisconnectCalendar = async () => {
    await fetch('/auth/disconnect-calendar', { method: 'POST' });
    await refresh();
  };

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar lastUpdate={lastUpdate} countdown={countdown} onRefresh={onRefresh} />
        <SidebarInset>
          <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-5" />
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
              <CardContent className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {user.has_calendar ? (
                    <Badge variant="secondary" className="gap-1 bg-emerald-500/10 text-emerald-600">
                      <LinkIcon className="h-3 w-3" />
                      Polaczony
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <UnlinkIcon className="h-3 w-3" />
                      Nie polaczony
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
              </CardContent>
            </Card>

            {/* Logout */}
            <Card className="border-border">
              <CardContent className="pt-6">
                <Button variant="outline" className="gap-2 text-destructive hover:bg-destructive/10" onClick={logout}>
                  <LogOutIcon className="h-4 w-4" />
                  Wyloguj sie
                </Button>
              </CardContent>
            </Card>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
