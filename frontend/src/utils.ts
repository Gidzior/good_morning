export function formatTime(date: Date): string {
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function formatDayShort(date: Date): string {
  return date.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function formatDayHeader(date: Date, offset: number): string {
  const dayMonth = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }).toUpperCase();
  if (offset === 0) return `DZIŚ ${dayMonth}`;
  if (offset === 1) return `JUTRO ${dayMonth}`;
  const weekday = date.toLocaleDateString('pl-PL', { weekday: 'long' }).toUpperCase();
  return `${weekday} ${dayMonth}`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} min temu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} godz. temu`;
  return `${Math.floor(hrs / 24)} dni temu`;
}

export function fmtPLN(val: number, maxDecimals = 2): string {
  return val.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: maxDecimals });
}

export function fmtChartDate(dateStr: string, period: number): string {
  const date = new Date(dateStr);
  if (period <= 90) return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  return date.toLocaleDateString('pl-PL', { month: 'short', year: '2-digit' });
}

export function getGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Dobranoc';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Cześć';
  return 'Dobry wieczór';
}

export function getFirstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
