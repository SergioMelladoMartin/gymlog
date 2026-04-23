import { useEffect, useState } from 'react';
import { isSignedIn, signIn } from '../lib/auth';
import { importBytes, loadDatabase } from '../lib/sqlite';

export default function LoginView() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isSignedIn()) window.location.replace('/');
  }, []);

  async function handleGoogle() {
    setErr(null);
    setBusy(true);
    try {
      await signIn();
      await loadDatabase({ seedUrl: import.meta.env.DEV ? '/seed.fitnotes' : undefined });
      window.location.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  }

  async function handleUpload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await importBytes(bytes);
      window.location.replace('/');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center gap-6 py-10">
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent text-ink">
          <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.4 14.4 9.6 9.6" />
            <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
            <path d="m21.5 21.5-1.4-1.4" />
            <path d="M3.9 3.9 2.5 2.5" />
            <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
          </svg>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">gymlog</h1>
        <p className="mt-2 text-sm text-muted">
          Tus entrenos en tu Google Drive. Sin servidor, sin base de datos, solo tú.
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="flex items-center justify-center gap-3 rounded-xl border border-border bg-card px-4 py-3 font-medium transition hover:border-strong hover:bg-elevated disabled:opacity-50"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.19 3.32v2.77h3.54c2.08-1.92 3.29-4.74 3.29-8.1z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.54-2.77c-.98.66-2.23 1.06-3.74 1.06-2.87 0-5.3-1.94-6.17-4.54H2.18v2.84A11 11 0 0 0 12 23z"/>
          <path fill="#FBBC05" d="M5.83 14.09A6.62 6.62 0 0 1 5.47 12c0-.73.13-1.44.36-2.09V7.07H2.18a11 11 0 0 0 0 9.86l3.65-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.07.56 4.22 1.64l3.15-3.15A11 11 0 0 0 12 1a11 11 0 0 0-9.82 6.07l3.65 2.84C6.7 7.32 9.13 5.38 12 5.38z"/>
        </svg>
        {busy ? 'Conectando…' : 'Continuar con Google'}
      </button>

      <div className="relative my-2 text-center text-xs uppercase tracking-wider text-muted">
        <span className="relative z-10 bg-bg px-2">o</span>
        <span className="absolute inset-x-0 top-1/2 -z-0 h-px bg-border" />
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-sm text-muted transition hover:border-strong hover:text-fg">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
        Probar con un backup .fitnotes (local, no sube a Drive)
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

      {err && (
        <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {err}
        </div>
      )}

      <p className="text-center text-[11px] text-muted">
        Con Google: pedimos acceso <b>solo</b> a la carpeta oculta "appdata" de tu Drive.
        Tus entrenos se guardan en un archivo <code>gymlog.fitnotes</code> compatible con la app FitNotes.
      </p>
    </div>
  );
}
