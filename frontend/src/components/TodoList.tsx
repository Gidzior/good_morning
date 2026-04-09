import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import Card from './DashboardCard';
import Loading from './Loading';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GoogleTask {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
}

interface TodoListProps {
  listId: string;
  listName: string;
  tick: number;
}

/** Sort: needsAction first, completed second, preserve position order within each group */
function sortTasks(tasks: GoogleTask[]): GoogleTask[] {
  const active = tasks.filter(t => t.status === 'needsAction');
  const done = tasks.filter(t => t.status === 'completed');
  return [...active, ...done];
}

export default function TodoList({ listId, listName, tick }: TodoListProps) {
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dragIdx = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragGhost = useRef<HTMLDivElement | null>(null);

  const apiBase = `/api/todo-lists/${encodeURIComponent(listId)}/tasks`;

  const loadTasks = useCallback(async () => {
    try {
      const r = await fetch(apiBase);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { items?: GoogleTask[]; error?: string };
      if (data.error) {
        setErrorMsg(data.error);
        setTasks([]);
        setLoading(false);
        return;
      }
      setTasks(sortTasks(data.items ?? []));
      setErrorMsg('');
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { loadTasks(); }, [loadTasks, tick]);

  // Close popover on outside click
  useEffect(() => {
    if (!showAdd) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        addBtnRef.current && !addBtnRef.current.contains(e.target as Node)
      ) {
        setShowAdd(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAdd]);

  const addTask = async () => {
    const title = newTitle.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      const r = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!r.ok) { console.error('Failed to add task:', r.status); return; }
      setNewTitle('');
      setShowAdd(false);
      await loadTasks();
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (taskId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'completed' ? 'needsAction' : 'completed';
    // Optimistic update with re-sort
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
      // Always reload to get correct position-based order
      await loadTasks();
    } catch (err) {
      console.error('Failed to toggle task:', err);
      await loadTasks();
    }
  };

  const deleteTask = async (taskId: string) => {
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
    if (fromIdx === null || fromIdx === targetIdx) return;

    // Reorder locally
    const updated = [...tasks];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setTasks(updated);

    // The task that should now be BEFORE the moved task (or null if moved to top)
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

  // Popover position
  const getPopoverStyle = (): React.CSSProperties => {
    if (!addBtnRef.current) return { position: 'fixed', top: 0, left: 0 };
    const rect = addBtnRef.current.getBoundingClientRect();
    return {
      position: 'fixed',
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
      zIndex: 50,
    };
  };

  const addButton = (
    <button
      ref={addBtnRef}
      onClick={() => setShowAdd(prev => !prev)}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      title="Dodaj zadanie"
    >
      <Plus className="size-4" />
    </button>
  );

  return (
    <Card icon="✅" title={listName} action={addButton}>
      {errorMsg ? (
        <div className="text-sm text-muted-foreground py-4 text-center">{errorMsg}</div>
      ) : loading ? (
        <Loading text="Ładowanie zadań..." />
      ) : (
        <div className="flex flex-col flex-1 min-h-0">
          {tasks.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2 text-center">
              Brak zadań — kliknij <button onClick={() => setShowAdd(true)} className="text-primary underline">+</button> aby dodać
            </div>
          ) : (
            <div className="space-y-1 min-h-0 flex-1 overflow-y-auto">
              {tasks.map((task, idx) => (
                <div
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
                    clone.style.background = 'var(--color-card, #fff)';
                    clone.style.borderRadius = '0.5rem';
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
                    'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/50 cursor-grab active:cursor-grabbing',
                    task.status === 'completed' && 'opacity-50',
                    dragOverIdx === idx && 'border-t-2 border-primary',
                  )}
                >
                  <Checkbox
                    checked={task.status === 'completed'}
                    onCheckedChange={() => toggleTask(task.id, task.status)}
                    className="shrink-0"
                  />
                  <span className={cn(
                    'flex-1 text-sm',
                    task.status === 'completed' && 'line-through text-muted-foreground',
                  )}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Usuń zadanie"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && createPortal(
        <div ref={popoverRef} style={getPopoverStyle()} className="w-72 rounded-lg border bg-card p-3 shadow-lg">
          <div className="text-xs font-medium text-muted-foreground mb-2">Nowe zadanie</div>
          <div className="flex gap-2">
            <Input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addTask(); }}
              placeholder="Nazwa zadania..."
              disabled={adding}
              className="text-sm"
              autoFocus
            />
            <Button size="sm" onClick={addTask} disabled={!newTitle.trim() || adding}>
              {adding ? '...' : 'Dodaj'}
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </Card>
  );
}
