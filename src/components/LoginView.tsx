import { useEffect, useState } from 'react';
import { hasSession, signIn } from '../lib/auth';
import { importBytes } from '../lib/sqlite';
import { t } from '../lib/i18n';

const PENDING_IMPORT_NAME = 'pending-import.fitnotes';

async function opfsWritePending(bytes: Uint8Array): Promise<void> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(PENDING_IMPORT_NAME, { create: true });
  const w = await (handle as any).createWritable();
  await w.write(bytes);
  await w.close();
}

async function opfsReadAndClearPending(): Promise<Uint8Array | null> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(PENDING_IMPORT_NAME, { create: false });
    const file = await handle.getFile();
    const bytes = new Uint8Array(await file.arrayBuffer());
    await root.removeEntry(PENDING_IMPORT_NAME).catch(() => {});
    return bytes;
  } catch {
    return null;
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  server_not_configured: 'auth.serverNotConfigured',
  state_mismatch: 'auth.error.state_mismatch',
  token_exchange_failed: 'auth.error.token_exchange_failed',
  missing_scope: 'auth.error.missing_scope',
};

export default function LoginView() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (hasSession()) {
      window.location.replace('/');
      return;
    }
    // Coming back from signIn('/login?import=1') with a pending backup
    // stashed in OPFS (see handleUpload below).
    const params = new URLSearchParams(location.search);
    const errorParam = params.get('error');
    if (errorParam) {
      setErr(t(ERROR_MESSAGES[errorParam] ?? 'auth.error.generic'));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('import') === '1' && hasSession()) {
      void (async () => {
        const bytes = await opfsReadAndClearPending();
        if (!bytes) return;
        setBusy(true);
        try {
          await importBytes(bytes);
          window.location.replace('/');
        } catch (e: any) {
          setErr(e?.message ?? String(e));
          setBusy(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleGoogle() {
    setErr(null);
    setBusy(true);
    signIn('/');
  }

  async function handleUpload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!hasSession()) {
        // Stash the backup and come back through the OAuth flow before
        // importing — importBytes() needs a session to push to Drive.
        await opfsWritePending(bytes);
        signIn('/login?import=1');
        return;
      }
      await importBytes(bytes);
      window.location.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center py-10">
      <div className="card flex flex-col gap-6 p-6 sm:p-8">
      <div className="text-center">
        <div className="btn-accent accent-glow motion-safe:animate-[loginLogoIn_620ms_cubic-bezier(0.2,0.8,0.2,1)] mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.4 14.4 9.6 9.6" />
            <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
            <path d="m21.5 21.5-1.4-1.4" />
            <path d="M3.9 3.9 2.5 2.5" />
            <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
          </svg>
        </div>
        <h1 className="motion-safe:animate-[fadeIn_500ms_ease_80ms_both] text-3xl font-semibold tracking-tight">gymlog</h1>
        <p className="motion-safe:animate-[fadeIn_500ms_ease_160ms_both] mt-2 text-sm text-muted">
          {t('login.tagline')}
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="flex items-center justify-center gap-3 rounded-xl border border-border bg-elevated/70 px-4 py-3 font-medium transition hover:border-strong hover:bg-elevated active:scale-[0.97] disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.77h3.54c2.08-1.92 3.29-4.74 3.29-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.77c-.98.66-2.23 1.06-3.74 1.06-2.87 0-5.3-1.94-6.17-4.54H2.18v2.84A11 11 0 0 0 12 23z"/>
          <path fill="#FBBC05" d="M5.83 14.09A6.62 6.62 0 0 1 5.47 12c0-.73.13-1.44.36-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.65-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.22 1.64l3.15-3.15A11 11 0 0 0 12 1a11 11 0 0 0-9.82 6.07l3.65 2.84C6.7 7.32 9.13 5.38 12 5.38z"/>
        </svg>
        {busy ? t('login.connecting') : t('login.continueGoogle')}
      </button>

      {err && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {err}
        </div>
      )}

      <label className="mx-auto flex cursor-pointer items-center gap-1.5 text-center text-xs font-medium text-muted underline-offset-2 transition hover:text-fg hover:underline">
        {t('login.uploadBackupLink')}
        <input
          type="file"
          accept=".fitnotes,.db,.sqlite,application/x-sqlite3"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
      </label>

      <details className="group text-center text-[11px] text-muted">
        <summary className="cursor-pointer list-none font-medium text-muted transition hover:text-fg [&::-webkit-details-marker]:hidden">
          {t('login.howItWorks')}
        </summary>
        <p className="mt-2 text-left">
          {t('login.appdataInfo', { file: 'gymlog.fitnotes' })}
        </p>
      </details>
      </div>
    </div>
  );
}
