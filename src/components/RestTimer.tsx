import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../hooks/useT';

const LS_PRESET = 'gymlog-rest-preset';
const LS_AUTO = 'gymlog-rest-auto';
const PRESETS = [60, 90, 120, 180];

function vibrate(pattern: number | number[]) {
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch {}
}

export interface RestTimerHandle {
  /** Called by WorkoutLogger every time a set is saved. Starts the timer
   *  automatically when the "auto" toggle is on. */
  notifySetLogged: () => void;
}

interface Props {
  /** Bumped by the parent every time a set is logged. */
  triggerTick: number;
}

/**
 * Floating rest-timer widget: circular countdown ring, presets, +30s,
 * vibration + optional Notification on completion. Rendered through a
 * portal at <body> level (see the backdrop-filter/containing-block note in
 * global.css) and anchored above the mobile tab bar or bottom-right on
 * desktop.
 */
export default function RestTimer({ triggerTick }: Props) {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [preset, setPreset] = useState<number>(() => {
    try { return Number(localStorage.getItem(LS_PRESET)) || 90; } catch { return 90; }
  });
  const [auto, setAuto] = useState<boolean>(() => {
    try { return localStorage.getItem(LS_AUTO) === '1'; } catch { return false; }
  });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState(preset);
  const [expanded, setExpanded] = useState(false);
  const endAtRef = useRef<number | null>(null);
  const notifiedRef = useRef(false);
  const firstRun = useRef(true);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    try { localStorage.setItem(LS_PRESET, String(preset)); } catch {}
  }, [preset]);
  useEffect(() => {
    try { localStorage.setItem(LS_AUTO, auto ? '1' : '0'); } catch {}
  }, [auto]);

  function start(seconds: number) {
    endAtRef.current = Date.now() + seconds * 1000;
    notifiedRef.current = false;
    setTotal(seconds);
    setRemaining(seconds);
  }

  // Auto-start on every logged set, if enabled.
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (auto) start(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerTick]);

  useEffect(() => {
    if (remaining === null) return;
    const id = setInterval(() => {
      const left = Math.max(0, Math.round(((endAtRef.current ?? 0) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        vibrate([80, 60, 80, 60, 120]);
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(t('timer.done'));
          }
        } catch {}
      }
    }, 250);
    return () => clearInterval(id);
  }, [remaining !== null, t]);

  function stop() {
    endAtRef.current = null;
    setRemaining(null);
  }

  function addThirty() {
    if (remaining === null) return;
    endAtRef.current = (endAtRef.current ?? Date.now()) + 30_000;
    setTotal((tv) => tv + 30);
    setRemaining((r) => (r ?? 0) + 30);
    notifiedRef.current = false;
  }

  async function toggleAuto() {
    const next = !auto;
    setAuto(next);
    if (next && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch {}
    }
  }

  if (!mounted) return null;

  const pct = remaining !== null && total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const running = remaining !== null;

  return createPortal(
    <div
      className="fixed z-40 flex flex-col items-end gap-2"
      style={{
        right: '1rem',
        bottom: 'calc(env(safe-area-inset-bottom) + 5.25rem)',
      }}
      data-resttimer
    >
      {expanded && (
        <div className="glass-float motion-safe:animate-[sheetIn_160ms_cubic-bezier(0.2,0.8,0.2,1)] w-56 rounded-2xl p-3 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="section-title">{t('timer.rest')}</span>
            <button type="button" onClick={() => setExpanded(false)} aria-label={t('action.close')} className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          </div>
          <div className="mb-2 flex gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setPreset(p); start(p); }}
                className={`flex-1 rounded-lg border px-1.5 py-1.5 text-xs font-semibold tabular-nums transition ${
                  preset === p ? 'border-accent/60 bg-accent-soft text-fg' : 'border-border bg-elevated/60 text-muted hover:text-fg'
                }`}
              >
                {p}s
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {running ? (
              <>
                <button type="button" onClick={addThirty} className="flex-1 rounded-lg border border-border bg-elevated/60 px-2 py-1.5 text-xs font-medium transition hover:bg-elevated">{t('timer.plus30')}</button>
                <button type="button" onClick={() => start(preset)} className="flex-1 rounded-lg border border-border bg-elevated/60 px-2 py-1.5 text-xs font-medium transition hover:bg-elevated">{t('timer.reset')}</button>
                <button type="button" onClick={stop} className="flex-1 rounded-lg border border-border bg-elevated/60 px-2 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/10">{t('timer.skip')}</button>
              </>
            ) : (
              <button type="button" onClick={() => start(preset)} className="btn-accent w-full rounded-lg py-1.5 text-xs">{t('timer.start')}</button>
            )}
          </div>
          <label className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
            <span className="text-[11px] text-muted">{t('timer.auto')}</span>
            <button
              type="button"
              role="switch"
              aria-checked={auto}
              onClick={toggleAuto}
              className={`relative h-5 w-9 shrink-0 rounded-full transition ${auto ? 'bg-accent' : 'bg-elevated'}`}
            >
              <span
                className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform"
                style={{ transform: auto ? 'translateX(18px)' : 'translateX(2px)' }}
              />
            </button>
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        aria-label={t('timer.rest')}
        className="btn-accent accent-glow relative grid h-14 w-14 place-items-center rounded-full active:scale-95"
      >
        <svg width="52" height="52" viewBox="0 0 52 52" className="absolute inset-0">
          <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="3" />
          {running && (
            <circle
              cx="26" cy="26" r={r} fill="none" stroke="var(--color-ink)" strokeWidth="3"
              strokeDasharray={circ} strokeDashoffset={circ - dash}
              strokeLinecap="round" transform="rotate(-90 26 26)"
              className="resttimer-ring"
            />
          )}
        </svg>
        {running ? (
          <span className="text-sm font-bold tabular-nums">{Math.floor((remaining ?? 0) / 60)}:{String((remaining ?? 0) % 60).padStart(2, '0')}</span>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        )}
      </button>
    </div>,
    document.body,
  );
}
