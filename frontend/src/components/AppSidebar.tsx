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
  RefreshCwIcon,
  LogOutIcon,
  UserIcon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AppSidebarProps {
  lastUpdate: Date;
  countdown: string;
  onRefresh: () => void;
  onAccount?: () => void;
}

const NAV_ITEMS = [
  { icon: CloudSunIcon, label: 'Pogoda' },
  { icon: QuoteIcon, label: 'Cytat dnia' },
  { icon: CalendarIcon, label: 'Kalendarz' },
  { icon: TrendingUpIcon, label: 'Kursy walut' },
  { icon: BarChart3Icon, label: 'Gielda' },
  { icon: NewspaperIcon, label: 'Wiadomosci' },
  { icon: RssIcon, label: 'RSS' },
] as const;

export default function AppSidebar({ lastUpdate, countdown, onRefresh, onAccount }: AppSidebarProps) {
  const { user, logout } = useAuth();

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4 group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-3">
        <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7 group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:text-sm">
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
        {/* User info */}
        {user && (
          <div className="mb-2 group-data-[collapsible=icon]:mb-0">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
              {user.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex min-w-0 flex-col group-data-[collapsible=icon]:hidden">
                <span className="truncate text-xs font-medium text-foreground">{user.name}</span>
                <span className="truncate text-[10px] text-muted-foreground">{user.email}</span>
              </div>
            </div>
            <div className="mt-1.5 flex gap-1 group-data-[collapsible=icon]:mt-1 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
              {onAccount && (
                <button
                  onClick={onAccount}
                  className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                  title="Konto"
                >
                  <UserIcon className="h-3.5 w-3.5" />
                  <span className="group-data-[collapsible=icon]:hidden">Konto</span>
                </button>
              )}
              <button
                onClick={logout}
                className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8"
                title="Wyloguj"
              >
                <LogOutIcon className="h-3.5 w-3.5" />
                <span className="group-data-[collapsible=icon]:hidden">Wyloguj</span>
              </button>
            </div>
          </div>
        )}

        <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

        {/* Refresh info */}
        <div className="flex flex-col gap-2 pt-2 group-data-[collapsible=icon]:hidden">
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
