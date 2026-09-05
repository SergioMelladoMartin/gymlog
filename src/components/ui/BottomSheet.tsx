/**
 * BottomSheet — generic modal surface.
 *
 * Mobile (<1024px): slides up from the bottom, draggable-to-close via
 * pointer events with an 80px threshold, top handle, safe-area padding.
 * Desktop (>=1024px): centred modal, no drag.
 *
 * Portalled to `document.body` — a `glass-float`/backdrop-filter ancestor
 * becomes a containing block for `position: fixed` descendants, which would
 * trap a fixed sheet inside that ancestor's own stacking context instead of
 * floating over the whole page.
 *
 * Closes on Escape and on a backdrop click/tap. Locks body scroll while
 * open. Respects `prefers-reduced-motion` (drag still works, but the CSS
 * transition on release is skipped via the `motion-safe:` variant already
 * present in global.css keyframes — here we just avoid animating the open
 * transform manually when the media query matches).
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../hooks/useT';

const DRAG_CLOSE_THRESHOLD = 80;

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  className = '',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; active: boolean } | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) { setDragY(0); setDragging(false); }
  }, [open]);

  if (!mounted || !open) return null;

  function onHandlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragState.current = { startY: e.clientY, active: true };
    setDragging(true);
  }
  function onHandlePointerMove(e: React.PointerEvent) {
    const st = dragState.current;
    if (!st?.active) return;
    const dy = Math.max(0, e.clientY - st.startY);
    setDragY(dy);
  }
  function onHandlePointerUp() {
    const st = dragState.current;
    dragState.current = null;
    setDragging(false);
    if (st && dragY > DRAG_CLOSE_THRESHOLD) {
      onClose();
    }
    setDragY(0);
  }

  const overlay = (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center lg:items-center"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/50 motion-safe:animate-[fadeIn_150ms_ease]" aria-hidden="true" />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass-float relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[1.5rem] pb-[env(safe-area-inset-bottom)] lg:max-h-[85vh] lg:w-full lg:max-w-md lg:rounded-[var(--radius-card)] ${
          dragging ? '' : 'motion-safe:animate-[sheetIn_220ms_cubic-bezier(0.2,0.8,0.2,1)]'
        } ${className}`}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragging ? 'none' : undefined,
        }}
      >
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center pt-2.5 pb-1 active:cursor-grabbing lg:hidden"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          aria-label={t('sheet.dragHandle')}
        >
          <span className="h-1 w-9 rounded-full bg-strong" />
        </div>
        {title && (
          <div className="hidden shrink-0 items-center justify-between px-5 pt-4 pb-1 lg:flex">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('sheet.close')}
              className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-fg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
