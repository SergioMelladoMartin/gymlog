import { useEffect, useRef, useState } from 'react';
import { forceSync, getConflictCount, getSyncInfo, onSyncChange, type SyncState } from '../lib/sqlite';
import { getAuthStatus, onAuthChange, renewAccess, type AuthStatus } from '../lib/auth';
import { hapticSuccess } from '../lib/haptics';
import { useT } from '../hooks/useT';

/**
 * Compact sync pill in the header. States:
 *   • idle            → ✓ hace 3 min
 *   • dirty           → cambios sin subir (about to upload)
 *   • syncing         → subiendo
 *   • offline         → pendiente de subir: saved locally, waiting for signal
 *   • error           → error al sincronizar (Drive rejected the request)
 *   • token_expired   → renovar acceso a Drive
 * Plus a separate amber chip when a sync conflict left a copy in Settings.
 */
export default function SyncStatus() {
  const { t } = useT();
  const [info, setInfo] = useState(() => getSyncInfo());
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => getAuthStatus());
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [hasConflict, setHasConflict] = useState(false);
  const [, setTick] = useState(0);
  const prevState = useRef<SyncState>(info.state);

  useEffect(() => onSyncChange(setInfo), []);
  useEffect(() => onAuthChange(setAuthStatus), []);

  useEffect(() => {
    const refresh = () => { void getConflictCount().then((n) => setHasConflict(n > 0)); };
    refresh();
    window.addEventListener('gymlog:sync-conflict', refresh);
    return () => window.removeEventListener('gymlog:sync-conflict', refresh);
  }, []);

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

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { state, lastSyncAt } = info;
  useEffect(() => {
    if (prevState.current === 'syncing' && state === 'idle' && online) {
      hapticSuccess();
    }
    prevState.current = state;
  }, [state, online]);

  const tokenExpired = authStatus === 'token_expired';
  const waiting = state === 'offline' || (!online && state === 'dirty');

  let tone = 'text-muted';
  let icon: React.ReactNode = null;
  let label = '';
  let aria = '';

  if (state === 'syncing') {
    tone = 'text-amber-400';
    label = t('sync.syncing');
    icon = <SpinIcon />;
    aria = t('sync.syncing');
  } else if (waiting && !(online && tokenExpired)) {
    // Not an error: the workout is safe on the device and uploads by itself.
    // With no signal this wins over "renovar acceso": a renew can't work.
    tone = 'text-amber-400';
    label = t('sync.pending');
    icon = <CloudOffIcon />;
    aria = t('sync.pendingHint');
  } else if (!online) {
    tone = 'text-muted';
    label = t('sync.offline');
    icon = <CloudOffIcon />;
    aria = t('sync.offline');
  } else if (tokenExpired && state !== 'dirty') {
    tone = 'text-amber-400';
    label = t('sync.tokenExpired');
    icon = <KeyIcon />;
    aria = `${t('sync.tokenExpired')} — ${t('sync.tapToRenew')}`;
  } else if (state === 'dirty') {
    tone = 'text-amber-400';
    label = t('sync.dirty');
    icon = <DotIcon filled />;
    aria = `${t('sync.dirty')} — ${t('action.retry')}`;
  } else if (state === 'error') {
    tone = 'text-danger';
    label = t('sync.error');
    icon = <WarnIcon />;
    aria = `${t('sync.error')} — ${t('action.retry')}`;
  } else {
    tone = 'text-muted';
    label = relativeSync(lastSyncAt, t);
    icon = <CheckIcon />;
    aria = `${t('sync.synced')} ${label} — ${t('action.retry')}`;
  }

  async function handleClick() {
    if (tokenExpired && online) {
      const ok = await renewAccess(true);
      if (ok) await forceSync().catch(() => {});
      return;
    }
    await forceSync().catch(() => {});
  }

  return (
    <div className="flex items-center gap-1.5">
      {hasConflict && (
        <a
          href="/settings#sync-conflict"
          title={t('sync.conflictHint')}
          aria-label={t('sync.conflictHint')}
          className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[11px] font-medium text-amber-400"
        >
          <WarnIcon />
          <span className="hidden sm:inline">{t('sync.conflict')}</span>
        </a>
      )}
      <button
        type="button"
        onClick={() => { void handleClick(); }}
        disabled={state === 'syncing'}
        title={aria}
        aria-label={aria}
        className={`inline-flex items-center gap-1 rounded-full border border-border bg-card/70 px-2 py-1 text-[11px] font-medium tabular-nums transition hover:bg-elevated disabled:cursor-wait ${tone}`}
      >
        {icon}
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
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
function KeyIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15.5 7.5 2.893 2.893a1 1 0 0 0 1.414 0l2.379-2.379a1 1 0 0 0 0-1.414L19 4.5" />
      <path d="M7 11a4 4 0 1 0 0 8h1" />
    </svg>
  );
}
function CloudOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 2 20 20" />
      <path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
      <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
    </svg>
  );
}
