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

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'Dobranoc';
  if (h < 18) return 'Dzien Dobry';
  return 'Dobry Wieczor';
}
