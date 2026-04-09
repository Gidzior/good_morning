import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

interface DashboardCardProps {
  icon: string;
  title: string;
  action?: ReactNode;
  onSettings?: () => void;
  children: ReactNode;
}

export default function DashboardCard({ icon, title, action, onSettings, children }: DashboardCardProps) {
  return (
    <Card className="border-border bg-card shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="!flex !flex-row items-center gap-2.5 border-b border-border pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
          {icon}
        </div>
        <CardTitle className="flex-1 text-sm font-semibold text-foreground">
          {title}
        </CardTitle>
        {onSettings && (
          <Button variant="ghost" size="icon-sm" onClick={onSettings} className="ml-auto shrink-0 text-muted-foreground" title="Ustawienia">
            <Settings className="size-4" />
          </Button>
        )}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col">{children}</CardContent>
    </Card>
  );
}
