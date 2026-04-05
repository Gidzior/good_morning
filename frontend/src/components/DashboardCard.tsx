import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  icon: string;
  title: string;
  span?: 2 | 3;
  action?: ReactNode;
  children: ReactNode;
}

export default function DashboardCard({ icon, title, span, action, children }: DashboardCardProps) {
  return (
    <Card
      className={cn(
        'border-border bg-card shadow-sm hover:shadow-md transition-shadow',
        span === 2 && 'col-span-2',
        span === 3 && 'col-span-3',
      )}
    >
      <CardHeader className="!flex !flex-row items-center gap-2.5 border-b border-border pb-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xl">
          {icon}
        </div>
        <CardTitle className="flex-1 text-sm font-semibold text-foreground">
          {title}
        </CardTitle>
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
