import { useState } from 'react';
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
  RssIcon,
  QuoteIcon,
  RefreshCwIcon,
  LogOutIcon,
  UserIcon,
  LayoutGridIcon,
  RotateCcwIcon,
  PlusIcon,
  EyeIcon,
  EyeOffIcon,
  CheckSquareIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import DisableWidgetDialog from './DisableWidgetDialog';

interface DynamicWidgetInfo {
  id: string;
  name: string;
}

interface AppSidebarProps {
  lastUpdate: Date;
  countdown: string;
  onRefresh: () => void;
  onAccount?: () => void;
  editMode?: boolean;
  onToggleEdit?: () => void;
  onResetLayout?: () => void;
  onAddRss?: () => void;
  onAddTodo?: () => void;
  rssWidgets?: DynamicWidgetInfo[];
  todoWidgets?: DynamicWidgetInfo[];
  isWidgetEnabled?: (id: string) => boolean;
  onEnableWidget?: (id: string) => void;
  onDisableWidget?: (id: string, deleteData: boolean) => void;
}

interface WidgetMeta {
  id: string;
  icon: LucideIcon;
  label: string;
}

const STATIC_WIDGETS: WidgetMeta[] = [
  { id: 'weather', icon: CloudSunIcon, label: 'Pogoda' },
  { id: 'quote', icon: QuoteIcon, label: 'Cytat dnia' },
  { id: 'calendar', icon: CalendarIcon, label: 'Kalendarz' },
  { id: 'crypto', icon: TrendingUpIcon, label: 'Kryptowaluty' },
  { id: 'currencies', icon: BarChart3Icon, label: 'Kursy walut' },
  { id: 'stocks', icon: BarChart3Icon, label: 'Giełda' },
];

export default function AppSidebar({
  lastUpdate,
  countdown,
  onRefresh,
  onAccount,
  editMode,
  onToggleEdit,
  onResetLayout,
  onAddRss,
  onAddTodo,
  rssWidgets = [],
  todoWidgets = [],
  isWidgetEnabled,
  onEnableWidget,
  onDisableWidget,
}: AppSidebarProps) {
  const { user, logout } = useAuth();
  const [disableTarget, setDisableTarget] = useState<{ id: string; name: string } | null>(null);

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  const handleToggle = (widgetId: string, widgetName: string) => {
    const enabled = isWidgetEnabled ? isWidgetEnabled(widgetId) : true;
    if (enabled) {
      setDisableTarget({ id: widgetId, name: widgetName });
    } else {
      onEnableWidget?.(widgetId);
    }
  };

  const allWidgets: WidgetMeta[] = [
    ...STATIC_WIDGETS,
    ...todoWidgets.map(tw => ({
      id: `todo-${tw.id}`,
      icon: CheckSquareIcon,
      label: tw.name,
    })),
    ...rssWidgets.map(rw => ({
      id: `rss-${rw.id}`,
      icon: RssIcon,
      label: rw.name,
    })),
  ];

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-4 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2 group-data-[collapsible=icon]:min-h-[69px]">
          <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:justify-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-lg text-primary-foreground">
              ☀
            </div>
            <div className="flex flex-col group-data-[collapsible=icon]:hidden">
              <span className="text-sm font-bold text-foreground">Dzień Dobry</span>
              <span className="text-[11px] text-muted-foreground">Poranny dashboard</span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarSeparator />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Widgety</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="group-data-[collapsible=icon]:items-center">
                {allWidgets.map((widget) => {
                  const enabled = isWidgetEnabled ? isWidgetEnabled(widget.id) : true;
                  return (
                    <SidebarMenuItem key={widget.id}>
                      <SidebarMenuButton
                        tooltip={widget.label}
                        className={enabled ? '' : 'opacity-50'}
                        onClick={() => handleToggle(widget.id, widget.label)}
                      >
                        <widget.icon className="h-4 w-4" />
                        <span className="flex-1">{widget.label}</span>
                        {isWidgetEnabled && (
                          <span className="ml-auto text-muted-foreground group-data-[collapsible=icon]:hidden">
                            {enabled ? <EyeIcon className="size-3" /> : <EyeOffIcon className="size-3" />}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
                {onAddTodo && (
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Dodaj listę zadań" onClick={onAddTodo}>
                      <PlusIcon className="h-4 w-4" />
                      <span>Dodaj listę zadań</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {onAddRss && (
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Dodaj widget RSS" onClick={onAddRss}>
                      <PlusIcon className="h-4 w-4" />
                      <span>Dodaj RSS</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-1.5 group-data-[collapsible=icon]:py-3">
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
              <SidebarMenu className="mt-1.5 group-data-[collapsible=icon]:mt-1">
                {onAccount && (
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Konto" onClick={onAccount}>
                      <UserIcon className="h-4 w-4" />
                      <span>Konto</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Wyloguj" onClick={logout}>
                    <LogOutIcon className="h-4 w-4" />
                    <span>Wyloguj</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          )}

          {/* Layout edit */}
          <SidebarMenu className="group-data-[collapsible=icon]:items-center">
            {onToggleEdit && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={editMode ? 'Zakończ edycję' : 'Edytuj layout'}
                  onClick={onToggleEdit}
                  className={editMode ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground' : ''}
                >
                  <LayoutGridIcon className="h-4 w-4" />
                  <span>{editMode ? 'Gotowe' : 'Edytuj'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            {editMode && onResetLayout && (
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Resetuj layout" onClick={onResetLayout}>
                  <RotateCcwIcon className="h-4 w-4" />
                  <span>Reset</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>

          <SidebarSeparator className="mx-0 group-data-[collapsible=icon]:hidden" />

          {/* Refresh info */}
          <div className="flex flex-col gap-2 pt-2 group-data-[collapsible=icon]:hidden">
            <div className="text-[11px] text-muted-foreground">
              <div>Aktualizacja: {fmtTime(lastUpdate)}</div>
              {countdown && <div>Następna: {countdown}</div>}
            </div>
            <button
              onClick={onRefresh}
              className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-accent-indigo-light"
            >
              <RefreshCwIcon className="h-3 w-3" />
              Odśwież
            </button>
          </div>
          <SidebarMenu className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center">
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Odśwież" onClick={onRefresh}>
                <RefreshCwIcon className="h-4 w-4" />
                <span>Odśwież</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <DisableWidgetDialog
        open={disableTarget !== null}
        widgetName={disableTarget?.name ?? ''}
        onKeepData={() => {
          if (disableTarget) onDisableWidget?.(disableTarget.id, false);
          setDisableTarget(null);
        }}
        onDeleteData={() => {
          if (disableTarget) onDisableWidget?.(disableTarget.id, true);
          setDisableTarget(null);
        }}
        onCancel={() => setDisableTarget(null)}
      />
    </>
  );
}
