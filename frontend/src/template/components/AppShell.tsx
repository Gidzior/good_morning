import type { ReactNode } from 'react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

interface AppShellProps {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
}

/**
 * Reusable dashboard shell with sidebar + header layout.
 *
 * Usage:
 *   <AppShell
 *     sidebar={<AppSidebar ... />}
 *     header={<DashboardHeader ... />}
 *   >
 *     <div className="grid grid-cols-3 gap-5">
 *       {cards}
 *     </div>
 *   </AppShell>
 */
export function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        {sidebar}
        <SidebarInset>
          {header}
          <div className="p-6 max-sm:p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
