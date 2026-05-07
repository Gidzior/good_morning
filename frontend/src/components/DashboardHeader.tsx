import { useEffect, useRef, useState } from 'react';
import { CakeIcon, GiftIcon, SearchIcon, SettingsIcon, LogOutIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { formatDate, formatTime, getFirstName, getGreeting, getInitials } from '../utils';
import { getTodayNameday } from './Nameday';
import { getTodayHoliday } from '../lib/holidays';

interface DashboardHeaderProps {
  now: Date;
  onAccount?: () => void;
}

export default function DashboardHeader({ now, onAccount }: DashboardHeaderProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const greeting = getGreeting(now);
  const firstName = user ? getFirstName(user.name) : '';
  const nameday = getTodayNameday();
  const holiday = getTodayHoliday(now);
  const initials = user ? getInitials(user.name) : '?';

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[color:var(--line)] bg-[color:var(--bg)] px-4 py-4 sm:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="font-serif text-[22px] font-medium tracking-[-0.01em] text-[color:var(--ink)]">
              {greeting}{firstName ? `, ${firstName}` : ''}.
            </span>
            <span className="text-[color:var(--ink-3)]">·</span>
            <span className="text-sm text-[color:var(--ink-2)]">{formatDate(now)}</span>
            <span className="text-[color:var(--ink-3)] max-sm:hidden">·</span>
            <span className="font-mono text-[13px] text-[color:var(--ink-3)] max-sm:hidden">
              {formatTime(now)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nameday && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] px-2.5 py-1 text-xs"
                title="Imieniny"
              >
                <CakeIcon className="size-3.5 text-[color:var(--ink-3)]" />
                <span className="text-[color:var(--ink-3)]">Imieniny:</span>
                <span className="text-[color:var(--ink)]">{nameday}</span>
              </div>
            )}
            {holiday && (
              <div
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent-soft)] px-2.5 py-1 text-xs"
                title="Nietypowe święto"
              >
                <GiftIcon className="size-3.5 text-[color:var(--accent)]" />
                <span className="text-[color:var(--accent)]">Dziś:</span>
                <span className="font-semibold text-[color:var(--accent)]">{holiday}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          aria-label="Wyszukaj"
          className="hidden size-9 items-center justify-center rounded-lg border border-transparent text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--line)] hover:bg-[color:var(--surface)] sm:inline-flex"
        >
          <SearchIcon className="size-4" />
        </button>
        <button
          type="button"
          aria-label="Ustawienia"
          onClick={onAccount}
          className="hidden size-9 items-center justify-center rounded-lg border border-transparent text-[color:var(--ink-2)] transition-colors hover:border-[color:var(--line)] hover:bg-[color:var(--surface)] sm:inline-flex"
        >
          <SettingsIcon className="size-4" />
        </button>
        {user && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex items-center gap-2.5 rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] py-1 pl-1 pr-3 transition-colors hover:bg-[color:var(--accent-soft)]"
            >
              <Avatar user={user} initials={initials} size={30} fontSize={12} />
              <div className="hidden text-left leading-tight md:block">
                <div className="text-[13px] font-semibold text-[color:var(--ink)]">{user.name}</div>
                <div className="text-[11px] text-[color:var(--ink-3)]">{user.email}</div>
              </div>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 origin-top-right animate-in fade-in slide-in-from-top-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] p-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.18)]">
                <div className="mb-1.5 flex items-center gap-2.5 border-b border-[color:var(--line)] p-2.5">
                  <Avatar user={user} initials={initials} size={36} fontSize={13} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[color:var(--ink)]">{user.name}</div>
                    <div className="truncate text-xs text-[color:var(--ink-3)]">{user.email}</div>
                  </div>
                </div>
                {onAccount && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onAccount(); }}
                    className="flex w-full items-center gap-2.5 rounded-lg bg-transparent px-2.5 py-2.5 text-left text-[13px] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--accent-soft)]"
                  >
                    <SettingsIcon className="size-[15px]" />
                    Ustawienia konta
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="flex w-full items-center gap-2.5 rounded-lg bg-transparent px-2.5 py-2.5 text-left text-[13px] text-[color:var(--ink)] transition-colors hover:bg-[color:var(--accent-soft)]"
                >
                  <LogOutIcon className="size-[15px]" />
                  Wyloguj
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

interface AvatarProps {
  user: { avatar_url: string | null };
  initials: string;
  size: number;
  fontSize: number;
}

function Avatar({ user, initials, size, fontSize }: AvatarProps) {
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        referrerPolicy="no-referrer"
        className="rounded-full"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[0.02em] text-white"
      style={{ width: size, height: size, fontSize, background: 'var(--accent)' }}
    >
      {initials}
    </div>
  );
}
