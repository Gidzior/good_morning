import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  CloudSunIcon,
  CalendarIcon,
  TrendingUpIcon,
  BarChart3Icon,
  NewspaperIcon,
  RssIcon,
  QuoteIcon,
  CakeIcon,
  RefreshCwIcon,
} from 'lucide-react';

interface AppSidebarProps {
  lastUpdate: Date;
  countdown: string;
  onRefresh: () => void;
}

const NAV_ITEMS = [
  { icon: CloudSunIcon, label: 'Pogoda' },
  { icon: QuoteIcon, label: 'Cytat dnia' },
  { icon: CalendarIcon, label: 'Kalendarz' },
  { icon: CakeIcon, label: 'Imieniny' },
  { icon: TrendingUpIcon, label: 'Kursy walut' },
  { icon: BarChart3Icon, label: 'Gielda' },
  { icon: NewspaperIcon, label: 'Wiadomosci' },
  { icon: RssIcon, label: 'RSS' },
] as const;

export default function AppSidebar({ lastUpdate, countdown, onRefresh }: AppSidebarProps) {
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground">
            ☀
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold text-foreground">Dzien Dobry</span>
            <span className="text-[11px] text-muted-foreground">Poranny dashboard</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Panel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.label}>
                  <SidebarMenuButton tooltip={item.label}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-3">
        <div className="flex flex-col gap-2 group-data-[collapsible=icon]:hidden">
          <div className="text-[11px] text-muted-foreground">
            <div>Aktualizacja: {fmtTime(lastUpdate)}</div>
            {countdown && <div>Nastepna: {countdown}</div>}
          </div>
          <button
            onClick={onRefresh}
            className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-accent-indigo-light"
          >
            <RefreshCwIcon className="h-3 w-3" />
            Odswiez
          </button>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <button
            onClick={onRefresh}
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <RefreshCwIcon className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
