/**
 * ConfirmDialog + useConfirm() — replacement for window.confirm().
 *
 * API
 * ----
 * import { useConfirm } from './ConfirmDialog';
 *
 * function MyComponent() {
 *   const confirm = useConfirm();
 *   async function onDelete() {
 *     const ok = await confirm({
 *       title: 'Borrar serie',
 *       body: '¿Seguro que quieres borrar esta serie?',
 *       confirmLabel: 'Borrar',      // optional, defaults to t('action.confirm')
 *       cancelLabel: 'Cancelar',     // optional, defaults to t('action.cancel')
 *       destructive: true,          // optional, styles the confirm button as danger
 *     });
 *     if (!ok) return;
 *     // ... proceed
 *   }
 * }
 *
 * `confirm()` returns a Promise<boolean> that resolves `true` if the user
 * confirmed, `false` if they cancelled (Escape, backdrop click, or the
 * cancel button). Only one dialog can be open at a time; a second call
 * while one is open queues behind it.
 *
 * Rendering: mount <ConfirmDialogHost /> once near the root (it is bundled
 * into the same global UI host as <ToastHost/> in Layout.astro) — you do not
 * need to render anything yourself, just call the hook.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '../../hooks/useT';
import BottomSheet from './BottomSheet';

export interface ConfirmOptions {
  title?: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

type Listener = (p: PendingConfirm | null) => void;

let current: PendingConfirm | null = null;
let queue: PendingConfirm[] = [];
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) l(current);
}

function advance() {
  current = queue.shift() ?? null;
  notify();
}

export function requestConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const pending: PendingConfirm = { ...opts, resolve };
    if (current) {
      queue.push(pending);
    } else {
      current = pending;
      notify();
    }
  });
}

/** Hook form: `const confirm = useConfirm(); const ok = await confirm({...})`. */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  return useCallback((opts: ConfirmOptions) => requestConfirm(opts), []);
}

function useConfirmState() {
  const [state, setState] = useState<PendingConfirm | null>(() => current);
  useEffect(() => {
    listeners.add(setState);
    return () => { listeners.delete(setState); };
  }, []);
  return state;
}

/** Global host — mount exactly once (see Layout.astro). */
export default function ConfirmDialogHost() {
  const pending = useConfirmState();
  const { t } = useT();
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback((value: boolean) => {
    if (!current) return;
    const { resolve } = current;
    resolve(value);
    advance();
  }, []);

  useEffect(() => {
    if (!pending) return;
    confirmBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close(false);
        return;
      }
      if (e.key === 'Tab') {
        // Simple focus trap: the dialog only has two focusable buttons.
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>('button');
        if (!focusables || focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [pending, close]);

  if (!pending) return null;

  return (
    <BottomSheet open={!!pending} onClose={() => close(false)} title={pending.title}>
      <div ref={dialogRef} role="alertdialog" aria-describedby="confirm-dialog-body" className="p-5 pt-2 lg:pt-1">
        {pending.title && (
          <h2 className="mb-1.5 text-base font-semibold lg:hidden">
            {pending.title}
          </h2>
        )}
        <p id="confirm-dialog-body" className="mb-5 text-sm text-muted">
          {pending.body}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-border bg-elevated/60 px-4 py-2 text-sm font-medium transition hover:bg-elevated active:scale-[0.97]"
            onClick={() => close(false)}
          >
            {pending.cancelLabel ?? t('action.cancel')}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={
              pending.destructive
                ? 'rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger/20 active:scale-[0.97]'
                : 'btn-accent rounded-lg px-4 py-2 text-sm active:scale-[0.97]'
            }
            onClick={() => close(true)}
          >
            {pending.confirmLabel ?? t('action.confirm')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
