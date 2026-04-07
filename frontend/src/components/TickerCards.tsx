import { cn } from '@/lib/utils';

export interface TickerData {
  id: string;
  label: string;
  displayValue: string;
  unit: string;
  change: number;
  error?: boolean;
}

function ChangeText({ change, error }: { change: number; error?: boolean }) {
  const isUp = change > 0, isDown = change < 0;
  return (
    <span className={cn('text-xs font-medium', isUp && 'text-green', isDown && 'text-red', !isUp && !isDown && 'text-muted-foreground')}>
      {error ? '—' : `${isUp ? '+' : ''}${change.toFixed(2)}%`}
    </span>
  );
}

export function TickerCard({ t, active, onSelect }: { t: TickerData; active: string; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(t.id)} className={cn(
      'rounded-lg border p-3 text-left transition-all',
      active === t.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border bg-card hover:border-primary/30 hover:shadow-sm',
    )}>
      <div className="text-xs font-medium text-muted-foreground">{t.label}</div>
      <div className="mt-1 text-base font-bold text-foreground">
        {t.error ? '—' : t.displayValue}
        <span className="ml-1 text-xs font-normal text-muted-foreground">{t.unit}</span>
      </div>
      <div className="mt-0.5"><ChangeText change={t.change} error={t.error} /></div>
    </button>
  );
}

export function TickerRow({ t, active, onSelect }: { t: TickerData; active: string; onSelect: (id: string) => void }) {
  return (
    <button onClick={() => onSelect(t.id)} className={cn(
      'flex items-center justify-between rounded-lg border px-3 py-2 transition-all',
      active === t.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30',
    )}>
      <span className="text-xs font-medium text-muted-foreground">{t.label}</span>
      <span className="text-sm font-bold text-foreground">{t.error ? '—' : `${t.displayValue} ${t.unit}`}</span>
      <ChangeText change={t.change} error={t.error} />
    </button>
  );
}

export function TickerGrid({ items, active, onSelect }: { items: TickerData[]; active: string; onSelect: (id: string) => void }) {
  return (
    <>
      <div className="mt-4 hidden sm:grid" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, 1fr)`, gap: '0.75rem' }}>
        {items.map(t => <TickerCard key={t.id} t={t} active={active} onSelect={onSelect} />)}
      </div>
      <div className="mt-4 flex flex-col gap-1 sm:hidden">
        {items.map(t => <TickerRow key={t.id} t={t} active={active} onSelect={onSelect} />)}
      </div>
    </>
  );
}
