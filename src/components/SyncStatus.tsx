import { useEffect, useState } from 'react';
import { flushNow, getSyncInfo, onSyncChange, type SyncState } from '../lib/sqlite';
import { useT } from '../hooks/useT';

/**
 * Compact sync pill in the header. Shows four states:
 *   • idle   → ✓ hace 3 min   (muted)
 *   • dirty  → ⏺ cambios      (amber)
 *   • syncing→ spinner subiendo (amber)
 *   • error  → ⚠ reintentar   (danger, clickable)
 * When offline the browser reports it and we show the offline label.
 */
export default function SyncStatus() {
  const { t } = useT();
  const [info, setInfo] = useState(() => getSyncInfo());
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [, setTick] = useState(0);

  useEffect(() => onSyncChange(setInfo), []);

  useEffect(() => {
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener('online', onOn);
    window.addEventListener('offline', onOff);
    return () => {
      window.removeEventListener('online', onOn);
      window.removeEventListener('offline', onOff);
    };
  }, []);

  // Re-render every 30s so "hace 2 min" ticks forward on its own.
  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { state, lastSyncAt } = info;
  const effState: SyncState = !online && state !== 'syncing' ? 'error' : state;

  let tone = 'text-muted';
  let icon: React.ReactNode = null;
  let label = '';
  let clickable = false;
  let aria = '';

  if (!online) {
    tone = 'text-muted';
    label = t('sync.offline');
    icon = <DotIcon />;
    aria = t('sync.offline');
  } else if (effState === 'syncing') {
    tone = 'text-amber-400';
    label = t('sync.syncing');
    icon = <SpinIcon />;
    aria = t('sync.syncing');
  } else if (effState === 'dirty') {
    tone = 'text-amber-400';
    label = t('sync.dirty');
    icon = <DotIcon filled />;
    aria = t('sync.dirty');
  } else if (effState === 'error') {
    tone = 'text-danger';
    label = t('sync.error');
    icon = <WarnIcon />;
    clickable = true;
    aria = `${t('sync.error')} — ${t('action.retry')}`;
  } else {
    tone = 'text-muted';
    label = relativeSync(lastSyncAt, t);
    icon = <CheckIcon />;
    aria = `${t('sync.synced')} ${label}`;
  }

  const className = `inline-flex items-center gap-1 rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] font-medium tabular-nums ${tone}`;

  if (clickable) {
    return (
      <button
        type="button"
        onClick={() => flushNow().catch(() => {})}
        title={aria}
        aria-label={aria}
        className={`${className} transition hover:bg-elevated`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  }
  return (
    <span title={aria} aria-label={aria} className={className}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

function relativeSync(ts: number | null, t: (k: string, v?: any) => string): string {
  if (!ts) return t('sync.synced');
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t('sync.justNow');
  if (min < 60) return t('sync.minAgo', { n: min });
  const h = Math.floor(min / 60);
  return t('sync.hourAgo', { n: h });
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function SpinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}
function DotIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="3">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
