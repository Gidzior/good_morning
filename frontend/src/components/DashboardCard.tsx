import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

interface DashboardCardProps {
  icon?: ReactNode;
  title: string;
  action?: ReactNode;
  onSettings?: () => void;
  children: ReactNode;
}

export default function DashboardCard({ icon, title, action, onSettings, children }: DashboardCardProps) {
  return (
    <Card className="border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[var(--shadow-1)] transition-shadow hover:shadow-md">
      <CardHeader className="!flex !flex-row items-center gap-2 border-b border-[color:var(--line)] pb-3">
        {icon && (
          <span
            className="inline-flex size-[15px] shrink-0 items-center justify-center text-[color:var(--accent)] [&_svg]:size-[15px]"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <CardTitle className="flex-1 text-[13px] font-semibold tracking-[-0.005em] text-[color:var(--ink)]">
          {title}
        </CardTitle>
        {onSettings && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onSettings}
            className="ml-auto shrink-0 text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
            title="Ustawienia"
          >
            <Settings className="size-4" />
          </Button>
        )}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">{children}</CardContent>
    </Card>
  );
}
