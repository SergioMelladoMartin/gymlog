/**
 * Toast — global notification queue, replacement for alert().
 *
 * API
 * ----
 * import { toast } from './Toast';
 *
 * toast.success('Guardado');
 * toast.error('No se pudo borrar el ejercicio');
 * toast.info('Copiado');
 * toast.custom(<div>🏆 Nuevo récord</div>, { duration: 2500 }); // arbitrary node
 *
 * Every call is fire-and-forget (no return value) and stacks — several
 * toasts can be visible at once, newest on top. Each auto-dismisses after
 * `duration` ms (default 3200, 2500 is a good fit for celebratory toasts)
 * unless the user taps it to dismiss early. Respects prefers-reduced-motion.
 *
 * Rendering: mount <ToastHost /> once near the root (bundled into the
 * global UI host in Layout.astro) — call `toast.*` from anywhere, no
 * provider/context needed.
 */
import { useEffect, useState, type ReactNode } from 'react';

export type ToastKind = 'success' | 'error' | 'info' | 'custom';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message?: string;
  node?: ReactNode;
  duration: number;
}

let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<(items: ToastItem[]) => void>();

function notify() {
  for (const l of listeners) l(items);
}

function push(item: Omit<ToastItem, 'id'>) {
  const id = ++seq;
  items = [...items, { ...item, id }];
  notify();
  return id;
}

function dismiss(id: number) {
  items = items.filter((i) => i.id !== id);
  notify();
}

export const toast = {
  success(message: string, opts?: { duration?: number }) {
    return push({ kind: 'success', message, duration: opts?.duration ?? 3200 });
  },
  error(message: string, opts?: { duration?: number }) {
    return push({ kind: 'error', message, duration: opts?.duration ?? 4000 });
  },
  info(message: string, opts?: { duration?: number }) {
    return push({ kind: 'info', message, duration: opts?.duration ?? 3200 });
  },
  custom(node: ReactNode, opts?: { duration?: number }) {
    return push({ kind: 'custom', node, duration: opts?.duration ?? 3200 });
  },
  dismiss,
};

function useToastItems() {
  const [state, setState] = useState<ToastItem[]>(() => items);
  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return state;
}

function ToastRow({ item }: { item: ToastItem }) {
  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration]);

  if (item.kind === 'custom') {
    return (
      <div
        className="glass pointer-events-auto motion-safe:animate-[toastIn_220ms_cubic-bezier(0.2,0.8,0.2,1)] rounded-xl px-4 py-3 text-sm shadow-lg"
        onClick={() => dismiss(item.id)}
        role="status"
      >
        {item.node}
      </div>
    );
  }

  const toneClass =
    item.kind === 'error'
      ? 'border-danger/40 text-danger'
      : item.kind === 'success'
        ? 'border-success/40 text-success'
        : 'border-border text-fg';

  return (
    <div
      className={`glass pointer-events-auto flex items-center gap-2 motion-safe:animate-[toastIn_220ms_cubic-bezier(0.2,0.8,0.2,1)] rounded-xl border px-4 py-3 text-sm shadow-lg ${toneClass}`}
      onClick={() => dismiss(item.id)}
      role="status"
    >
      {item.kind === 'success' && <span aria-hidden="true">✓</span>}
      {item.kind === 'error' && <span aria-hidden="true">⚠</span>}
      <span className="min-w-0 flex-1">{item.message}</span>
    </div>
  );
}

/** Global host — mount exactly once (see Layout.astro). */
export default function ToastHost() {
  const list = useToastItems();
  if (list.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] flex flex-col items-center gap-2 p-3"
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm flex-col gap-2">
        {list.map((item) => (
          <ToastRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
