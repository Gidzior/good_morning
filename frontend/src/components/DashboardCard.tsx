import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface DashboardCardProps {
  icon: string;
  title: string;
  span?: 2 | 3;
  children: ReactNode;
}

export default function DashboardCard({ icon, title, span, children }: DashboardCardProps) {
  return (
    <Card
      className={cn(
        'border-border bg-card hover:border-accent-indigo transition-colors',
        span === 2 && 'col-span-2',
        span === 3 && 'col-span-3',
      )}
    >
      <CardHeader className="flex-row items-center gap-2.5 border-b border-border pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-hover text-xl">
          {icon}
        </div>
        <CardTitle className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
