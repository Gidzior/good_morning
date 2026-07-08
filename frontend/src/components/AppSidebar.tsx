import { useState } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CloudSunIcon,
  CalendarIcon,
  TrendingUpIcon,
  BarChart3Icon,
  RssIcon,
  QuoteIcon,
  RefreshCwIcon,
  LogOutIcon,
  LayoutGridIcon,
  RotateCcwIcon,
  PlusIcon,
  ListTodoIcon,
  Trash2Icon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getInitials } from '../utils';
import { cn } from '@/lib/utils';
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
  onRequestDeleteList?: (target: { id: string; name: string }) => void;
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
  onRequestDeleteList,
  rssWidgets = [],
  todoWidgets = [],
  isWidgetEnabled,
  onEnableWidget,
  onDisableWidget,
}: AppSidebarProps) {
  const { user, logout } = useAuth();
  const [disableTarget, setDisableTarget] = useState<{ id: string; name: string } | null>(null);

  const handleToggle = (widgetId: string, widgetName: string) => {
    const enabled = isWidgetEnabled ? isWidgetEnabled(widgetId) : true;
    if (enabled) {
      setDisableTarget({ id: widgetId, name: widgetName });
    } else {
      onEnableWidget?.(widgetId);
    }
  };

  const widgetRows: WidgetMeta[] = [
    ...STATIC_WIDGETS,
    ...(todoWidgets.length > 0
      ? [{ id: 'todos', icon: ListTodoIcon, label: 'Zadania' }]
      : []),
    ...rssWidgets.map((rw) => ({
      id: `rss-${rw.id}`,
      icon: RssIcon,
      label: rw.name,
    })),
  ];

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="h-[73px] border-b border-[color:var(--line)] p-0">
          <div className="flex h-full items-center justify-between gap-2 px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
            <div className="flex items-center gap-2.5 group-data-[collapsible=icon]:hidden">
              <div className="size-3.5 shrink-0 rounded-[3px] bg-[color:var(--ink)]" />
              <span className="font-serif text-[18px] tracking-[-0.01em] text-[color:var(--ink)]">
                dashboard
              </span>
            </div>
            <SidebarTrigger className="size-8 text-[color:var(--ink-2)]" />
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2 py-2">
          <Section title="Widgety">
            {widgetRows.map((w) => (
              <WidgetToggleRow
                key={w.id}
                meta={w}
                enabled={isWidgetEnabled ? isWidgetEnabled(w.id) : true}
                onToggle={() => handleToggle(w.id, w.label)}
              />
            ))}
          </Section>

          <Section
            title="Listy zadań"
            action={
              onAddTodo ? (
                <AddButton label="Dodaj listę zadań" onClick={onAddTodo} />
              ) : null
            }
            hideWhenCollapsed
          >
            {todoWidgets.length === 0 ? (
              <EmptyHint>Brak list</EmptyHint>
            ) : (
              todoWidgets.map((t) => (
                <ItemRow
                  key={t.id}
                  label={t.name}
                  dotColor="var(--ink-3)"
                  onDelete={onRequestDeleteList ? () => onRequestDeleteList({ id: t.id, name: t.name }) : undefined}
                  deleteLabel="Usuń listę"
                />
              ))
            )}
          </Section>

          <Section
            title="Kanały RSS"
            action={
              onAddRss ? (
                <AddButton label="Dodaj kanał RSS" onClick={onAddRss} />
              ) : null
            }
            hideWhenCollapsed
          >
            {rssWidgets.length === 0 ? (
              <EmptyHint>Brak kanałów</EmptyHint>
            ) : (
              rssWidgets.map((f) => (
                <ItemRow
                  key={f.id}
                  label={f.name}
                  dotColor="var(--ink-3)"
                />
              ))
            )}
          </Section>
        </SidebarContent>

        <SidebarFooter className="border-t border-[color:var(--line)] p-2.5">
          <div className="flex flex-col gap-2 group-data-[collapsible=icon]:items-center">
            <div className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
              {onToggleEdit && (
                <FooterIconButton
                  label={editMode ? 'Zakończ edycję' : 'Edytuj layout'}
                  active={editMode}
                  onClick={onToggleEdit}
                  icon={LayoutGridIcon}
                />
              )}
              {editMode && onResetLayout && (
                <FooterIconButton
                  label="Resetuj layout"
                  onClick={onResetLayout}
                  icon={RotateCcwIcon}
                />
              )}
              <FooterIconButton
                label={countdown ? `Odśwież (${countdown})` : 'Odśwież'}
                onClick={onRefresh}
                icon={RefreshCwIcon}
              />
            </div>

            {user && (
              <UserPill
                name={user.name}
                email={user.email}
                avatarUrl={user.avatar_url}
                onAccount={onAccount}
                onLogout={logout}
              />
            )}

            <div className="px-1 text-[10px] text-[color:var(--ink-3)] group-data-[collapsible=icon]:hidden">
              Aktualizacja: {lastUpdate.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
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

interface SectionProps {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  hideWhenCollapsed?: boolean;
}

function Section({ title, action, children, hideWhenCollapsed }: SectionProps) {
  return (
    <div className={cn('px-1 pt-3 pb-1 first:pt-1', hideWhenCollapsed && 'group-data-[collapsible=icon]:hidden')}>
      <div className="flex items-center justify-between px-2 pb-2 group-data-[collapsible=icon]:hidden">
        <span className="font-mono text-[11px] uppercase tracking-[0.10em] text-[color:var(--ink-3)]">
          {title}
        </span>
        {action}
      </div>
      <div className="flex flex-col gap-px">{children}</div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="inline-flex size-[22px] items-center justify-center rounded-md border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent)]"
          >
            <PlusIcon className="size-3.5" />
          </button>
        }
      />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

interface WidgetToggleRowProps {
  meta: WidgetMeta;
  enabled: boolean;
  onToggle: () => void;
}

function WidgetToggleRow({ meta, enabled, onToggle }: WidgetToggleRowProps) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const Icon = meta.icon;

  const button = (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className={cn(
        'group/row flex w-full min-h-[34px] items-center gap-2.5 rounded-lg border-none px-2.5 py-2 text-left text-[13.5px] transition-colors',
        'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0',
        enabled
          ? 'bg-[color:var(--accent-soft)] text-[color:var(--accent)]'
          : 'bg-transparent text-[color:var(--ink-2)] hover:bg-[color:var(--accent-soft)]/50',
      )}
    >
      <Icon
        className="size-4 shrink-0"
        style={{ color: enabled ? 'var(--accent)' : 'var(--ink-3)' }}
      />
      <span
        className={`flex-1 truncate group-data-[collapsible=icon]:hidden ${
          enabled ? 'font-semibold' : 'font-medium'
        }`}
      >
        {meta.label}
      </span>
      <SwitchPill enabled={enabled} className="group-data-[collapsible=icon]:hidden" />
    </button>
  );

  if (!collapsed) return button;

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right">{meta.label}</TooltipContent>
    </Tooltip>
  );
}

function SwitchPill({ enabled, className = '' }: { enabled: boolean; className?: string }) {
  return (
    <span
      className={`relative inline-block h-3.5 w-[26px] shrink-0 rounded-full transition-colors ${className}`}
      style={{ background: enabled ? 'var(--accent)' : 'var(--line-strong)' }}
      aria-hidden
    >
      <span
        className="absolute left-[2px] top-[2px] size-2.5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform"
        style={{ transform: enabled ? 'translateX(12px)' : 'translateX(0)' }}
      />
    </span>
  );
}

interface ItemRowProps {
  label: string;
  dotColor: string;
  onDelete?: () => void;
  deleteLabel?: string;
}

function ItemRow({ label, dotColor, onDelete, deleteLabel = 'Usuń' }: ItemRowProps) {
  return (
    <div className="group/item flex min-h-[34px] items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-[color:var(--ink-2)]">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: dotColor }}
        aria-hidden
      />
      <span className="flex-1 truncate group-data-[collapsible=icon]:hidden">{label}</span>
      {onDelete && (
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={deleteLabel}
                onClick={onDelete}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[color:var(--ink-3)] opacity-0 transition-opacity hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--bad)] group-hover/item:opacity-100 group-data-[collapsible=icon]:hidden"
              >
                <Trash2Icon className="size-3.5" />
              </button>
            }
          />
          <TooltipContent side="right">{deleteLabel}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-1 text-xs text-[color:var(--ink-3)] group-data-[collapsible=icon]:hidden">
      {children}
    </div>
  );
}

interface FooterIconButtonProps {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
}

function FooterIconButton({ label, icon: Icon, onClick, active }: FooterIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className={`inline-flex size-8 items-center justify-center rounded-lg border border-transparent transition-colors ${
              active
                ? 'bg-[color:var(--accent)] text-white'
                : 'text-[color:var(--ink-2)] hover:border-[color:var(--line)] hover:bg-[color:var(--accent-soft)]'
            }`}
          >
            <Icon className="size-4" />
          </button>
        }
      />
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

interface UserPillProps {
  name: string;
  email: string;
  avatarUrl: string | null;
  onAccount?: () => void;
  onLogout: () => void;
}

function UserPill({ name, email, avatarUrl, onAccount, onLogout }: UserPillProps) {
  const initials = getInitials(name);
  const avatar = avatarUrl ? (
    <img
      src={avatarUrl}
      alt=""
      referrerPolicy="no-referrer"
      className="size-[30px] shrink-0 rounded-full"
    />
  ) : (
    <div className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-[11px] font-semibold text-white">
      {initials}
    </div>
  );

  return (
    <div className="flex items-center gap-2.5 rounded-xl p-1.5 group-data-[collapsible=icon]:p-0">
      <button
        type="button"
        onClick={onAccount}
        aria-label={onAccount ? 'Otwórz konto' : name}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-0.5 text-left transition-colors hover:bg-[color:var(--accent-soft)]/60 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:p-0"
      >
        {avatar}
        <div className="min-w-0 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-[12.5px] font-semibold text-[color:var(--ink)]">
            {name}
          </div>
          <div className="truncate text-[11px] text-[color:var(--ink-3)]">{email}</div>
        </div>
      </button>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Wyloguj"
              onClick={onLogout}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[color:var(--ink-2)] transition-colors hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--accent)] group-data-[collapsible=icon]:hidden"
            >
              <LogOutIcon className="size-[15px]" />
            </button>
          }
        />
        <TooltipContent side="top">Wyloguj</TooltipContent>
      </Tooltip>
    </div>
  );
}
