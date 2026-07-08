import { useState, useEffect, useCallback, useRef } from 'react';
import Card from './DashboardCard';
import Loading from './Loading';
import { CheckIcon, PlusIcon, XIcon, Trash2Icon, ListTodoIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiFetch, ApiError } from '@/lib/api';

interface GoogleTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
}

export interface TodoListInfo {
  id: string;
  name: string;
}

interface TodoListProps {
  lists: TodoListInfo[];
  tick: number;
  onRequestDeleteList?: (target: { id: string; name: string }) => void;
}

/** Sort: needsAction first, completed second, preserve position order within each group */
function sortTasks(tasks: GoogleTask[]): GoogleTask[] {
  const active = tasks.filter(t => t.status === 'needsAction');
  const done = tasks.filter(t => t.status === 'completed');
  return [...active, ...done];
}

export default function TodoList({ lists, tick, onRequestDeleteList }: TodoListProps) {
  const [activeId, setActiveId] = useState<string | null>(lists[0]?.id ?? null);
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragGhost = useRef<HTMLDivElement | null>(null);

  const activeList = activeId ? lists.find(l => l.id === activeId) ?? null : null;

  // Keep active id in sync as lists change
  useEffect(() => {
    if (lists.length === 0) {
      if (activeId !== null) setActiveId(null);
      return;
    }
    if (!activeId || !lists.some(l => l.id === activeId)) {
      setActiveId(lists[0].id);
    }
  }, [lists, activeId]);

  const apiBase = activeId ? `/api/todo-lists/${encodeURIComponent(activeId)}/tasks` : null;

  const loadTasks = useCallback(async () => {
    if (!apiBase) { setTasks([]); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<{ items?: GoogleTask[] }>(apiBase);
      setTasks(sortTasks(data.items ?? []));
      setErrorMsg('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setErrorMsg('Google Tasks niepołączone — przejdź do ustawień konta.');
      } else {
        console.error('Failed to load tasks:', err);
        setErrorMsg('Nie udało się pobrać zadań');
      }
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { loadTasks(); }, [loadTasks, tick]);

  const addTask = async () => {
    const title = draft.trim();
    if (!title || adding || !apiBase) return;
    setAdding(true);
    try {
      const r = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!r.ok) { console.error('Failed to add task:', r.status); return; }
      setDraft('');
      await loadTasks();
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    if (!apiBase) return;
    const newStatus = currentStatus === 'completed' ? 'needsAction' : 'completed';
    setTasks(prev => sortTasks(prev.map(t =>
      t.id === taskId ? { ...t, status: newStatus as GoogleTask['status'] } : t,
    )));
    try {
      const r = await fetch(`${apiBase}/${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!r.ok) { console.error('Failed to toggle task:', r.status); }
      await loadTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
      await loadTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!apiBase) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      const r = await fetch(`${apiBase}/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
      if (!r.ok) { console.error('Failed to delete task:', r.status); await loadTasks(); }
    } catch (err) {
      console.error('Failed to delete task:', err);
      await loadTasks();
    }
  };

  const handleDrop = async (targetIdx: number) => {
    const fromIdx = dragIdx.current;
    dragIdx.current = null;
    setDragOverIdx(null);
    if (fromIdx === null || fromIdx === targetIdx || !apiBase) return;

    const updated = [...tasks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setTasks(updated);

    const previousTaskId = targetIdx > 0 ? updated[targetIdx - 1].id : null;

    try {
      const r = await fetch(`${apiBase}/${encodeURIComponent(moved.id)}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ previousTaskId }),
      });
      if (!r.ok) { console.error('Failed to move task:', r.status); }
      await loadTasks();
    } catch (err) {
      console.error('Failed to move task:', err);
      await loadTasks();
    }
  };

  const total = tasks.length;
  const remaining = tasks.filter(t => t.status !== 'completed').length;
  const done = total - remaining;
  const pct = total > 0 ? (done / total) * 100 : 0;

  const meta = activeId && total > 0 ? (
    <span className="font-mono text-[11px] tracking-[0.04em] text-[color:var(--ink-3)]">
      {remaining} z {total}
    </span>
  ) : null;

  return (
    <Card icon={<ListTodoIcon />} title="Zadania" action={meta}>
      {lists.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-4 text-center text-sm text-[color:var(--ink-3)]">
          Brak list zadań — dodaj listę w panelu bocznym
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {activeList && (
            <div className="flex items-center gap-2">
              {lists.length > 1 ? (
                <div className="flex flex-1 gap-1 overflow-x-auto rounded-lg bg-[color:var(--bg)] p-0.5">
                  {lists.map((l) => {
                    const isActive = l.id === activeId;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => setActiveId(l.id)}
                        className={cn(
                          'whitespace-nowrap rounded-md border-none px-2.5 py-[5px] text-xs transition-colors',
                          isActive
                            ? 'bg-[color:var(--surface)] font-semibold text-[color:var(--ink)] shadow-[var(--shadow-1)]'
                            : 'bg-transparent text-[color:var(--ink-2)] hover:text-[color:var(--ink)]',
                        )}
                      >
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-1 gap-1 rounded-lg bg-[color:var(--bg)] p-0.5">
                  <span className="whitespace-nowrap rounded-md bg-[color:var(--surface)] px-2.5 py-[5px] text-xs font-semibold text-[color:var(--ink)] shadow-[var(--shadow-1)]">
                    {activeList.name}
                  </span>
                </div>
              )}
              {onRequestDeleteList && (
                <button
                  type="button"
                  onClick={() => onRequestDeleteList({ id: activeList.id, name: activeList.name })}
                  aria-label={`Usuń listę ${activeList.name}`}
                  title={`Usuń listę „${activeList.name}"`}
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[color:var(--ink-3)] transition-colors hover:bg-[color:var(--accent-soft)] hover:text-[color:var(--bad)]"
                >
                  <Trash2Icon className="size-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="h-[3px] overflow-hidden rounded-sm bg-[color:var(--bg)]">
            <div
              className="h-[3px] bg-[color:var(--accent)] transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>

          {errorMsg ? (
            <div className="py-4 text-center text-sm text-[color:var(--ink-3)]">{errorMsg}</div>
          ) : loading ? (
            <Loading text="Ładowanie zadań..." />
          ) : (
            <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0.5 overflow-y-auto p-0">
              {tasks.length === 0 ? (
                <li className="py-2 text-center text-sm text-[color:var(--ink-3)]">
                  Brak zadań — dodaj poniżej
                </li>
              ) : (
                tasks.map((task, idx) => {
                  const isDone = task.status === 'completed';
                  return (
                    <li
                      key={task.id}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        dragIdx.current = idx;
                        e.dataTransfer.effectAllowed = 'move';
                        const el = e.currentTarget;
                        const clone = el.cloneNode(true) as HTMLDivElement;
                        clone.style.position = 'fixed';
                        clone.style.top = '-9999px';
                        clone.style.width = `${el.offsetWidth}px`;
                        clone.style.background = 'var(--surface)';
                        clone.style.borderRadius = '8px';
                        clone.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                        document.body.appendChild(clone);
                        dragGhost.current = clone;
                        e.dataTransfer.setDragImage(clone, el.offsetWidth / 2, el.offsetHeight / 2);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverIdx(idx);
                      }}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(idx); }}
                      onDragEnd={() => {
                        dragIdx.current = null;
                        setDragOverIdx(null);
                        if (dragGhost.current) {
                          document.body.removeChild(dragGhost.current);
                          dragGhost.current = null;
                        }
                      }}
                      className={cn(
                        'group/todo flex cursor-grab items-center gap-2.5 px-0 py-2 active:cursor-grabbing',
                        isDone && 'opacity-50',
                        dragOverIdx === idx && 'border-t border-[color:var(--accent)]',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id, task.status)}
                        aria-pressed={isDone}
                        aria-label={isDone ? 'Oznacz jako niezrobione' : 'Oznacz jako zrobione'}
                        className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all duration-150"
                        style={{
                          background: isDone ? 'var(--accent)' : 'transparent',
                          borderColor: isDone ? 'var(--accent)' : 'var(--line-strong)',
                        }}
                      >
                        {isDone && <CheckIcon className="size-3 text-white" strokeWidth={3} />}
                      </button>
                      <span
                        className={cn(
                          'flex-1 truncate text-[13px] leading-[1.3] text-[color:var(--ink)]',
                          isDone && 'line-through',
                        )}
                      >
                        {task.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        aria-label="Usuń zadanie"
                        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-[color:var(--ink-3)] opacity-0 transition-opacity hover:text-[color:var(--bad)] group-hover/todo:opacity-60 group-hover/todo:hover:opacity-100"
                      >
                        <XIcon className="size-[13px]" />
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          )}

          {activeId && (
            <form
              onSubmit={(e) => { e.preventDefault(); addTask(); }}
              className="flex shrink-0 items-center gap-2 rounded-lg bg-[color:var(--bg)] px-2.5 py-2"
            >
              <PlusIcon className="size-3.5 shrink-0 text-[color:var(--ink-3)]" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Dodaj zadanie…"
                disabled={adding}
                className="flex-1 border-none bg-transparent text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-3)] focus:outline-none disabled:opacity-50"
              />
              {draft.trim() && (
                <button
                  type="submit"
                  disabled={adding}
                  className="rounded-md bg-[color:var(--ink)] px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {adding ? '...' : 'Dodaj'}
                </button>
              )}
            </form>
          )}
        </div>
      )}
    </Card>
  );
}
