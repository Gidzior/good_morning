import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { formatDate, formatTime, getGreeting } from '../utils';
import { getTodayNameday } from './Nameday';

interface DashboardHeaderProps {
  now: Date;
}

export default function DashboardHeader({ now }: DashboardHeaderProps) {
  const nameday = getTodayNameday();

  return (
    <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-1 items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">
            {getGreeting()} <span className="text-primary">👋</span>
          </h1>
          <p className="text-xs text-muted-foreground">
            {nameday ? `🎂 ${nameday}` : 'Twój poranny dashboard briefingowy'}
          </p>
        </div>
        <div className="text-right text-sm text-muted-foreground max-sm:hidden">
          <div className="font-semibold text-foreground">{formatDate(now)}</div>
          <div>{formatTime(now)}</div>
        </div>
      </div>
    </header>
  );
}
