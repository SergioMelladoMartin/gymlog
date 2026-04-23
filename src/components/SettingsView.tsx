import { useEffect, useState } from 'react';
import { signOut } from '../lib/auth';
import { exportBytes, importBytes, resetLocal, scheduleSync } from '../lib/sqlite';
import { useT } from '../hooks/useT';
import { setLang, type Lang } from '../lib/i18n';

const ACCENTS: Array<{ key: string; label: string; swatch: string }> = [
  { key: 'lime',   label: 'Lima',    swatch: '#a3e635' },
  { key: 'rose',   label: 'Rosa',    swatch: '#f472b6' },
  { key: 'red',    label: 'Rojo',    swatch: '#f87171' },
  { key: 'sky',    label: 'Azul',    swatch: '#7dd3fc' },
  { key: 'violet', label: 'Violeta', swatch: '#c4b5fd' },
  { key: 'mono',   label: 'Mono',    swatch: '#888888' },
];

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function SettingsView() {
  const { t, lang } = useT();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [accent, setAccent] = useState<string>('lime');
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [ua, setUa] = useState<{ ios: boolean; android: boolean }>({ ios: false, android: false });
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setTheme((document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark');
    setAccent(document.documentElement.getAttribute('data-accent') || 'lime');

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(standalone);

    const u = navigator.userAgent;
    setUa({ ios: /iPhone|iPad|iPod/i.test(u), android: /Android/i.test(u) });

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  }

  function setAccentColor(next: string) {
    if (next === 'lime') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', next);
    try { localStorage.setItem('accent', next); } catch {}
    setAccent(next);
  }

  async function promptInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setInstallEvent(null);
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await importBytes(bytes);
      await scheduleSync(true);
      window.location.assign('/');
    } catch (e: any) {
      alert(e?.message ?? 'Error al importar backup');
      setImporting(false);
    }
  }

  function handleExport() {
    setExporting(true);
    try {
      const bytes = exportBytes();
      const blob = new Blob([bytes], { type: 'application/vnd.sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `gymlog-${stamp}.fitnotes`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 0);
    } catch (e: any) {
      alert(e?.message ?? 'Error al exportar');
    } finally {
      setExporting(false);
    }
  }

  async function logout() {
    await signOut();
    await resetLocal();
    window.location.replace('/login');
  }

  function pickLang(next: Lang) {
    setLang(next);
  }

  return (
    <>
      <div className="mb-4">
        <a href="/profile" className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition hover:text-fg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          {t('nav.profile')}
        </a>
        <h1 className="text-3xl font-semibold tracking-tight">{t('settings.title')}</h1>
      </div>

      {/* Appearance */}
      <section className="card mb-4 p-4">
        <div className="section-title mb-3">{t('settings.appearance')}</div>

        <button
          type="button"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm transition hover:bg-elevated"
        >
          <span className="flex items-center gap-2.5">
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
            )}
            {t('settings.theme')}
          </span>
          <span className="text-muted">{theme === 'dark' ? t('settings.themeDark') : t('settings.themeLight')}</span>
        </button>

        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 px-2 text-xs text-muted">{t('settings.accent')}</div>
          <div className="flex flex-wrap gap-2 px-2">
            {ACCENTS.map((a) => {
              const isActive = accent === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setAccentColor(a.key)}
                  title={a.label}
                  aria-label={a.label}
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${isActive ? 'ring-2 ring-fg ring-offset-2 ring-offset-card' : 'opacity-70 hover:opacity-100'}`}
                  style={{ background: a.swatch }}
                >
                  {isActive && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 px-2 text-xs text-muted">{t('settings.language')}</div>
          <div className="flex gap-2 px-2">
            {(['es', 'en'] as const).map((code) => {
              const active = lang === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => pickLang(code)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'border-accent/60 bg-accent/15 text-fg'
                      : 'border-border bg-elevated text-muted hover:border-strong hover:text-fg'
                  }`}
                >
                  {code === 'es' ? '🇪🇸 Español' : '🇬🇧 English'}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Install */}
      {!isInstalled && (
        <section className="card mb-4 p-4">
          <div className="section-title mb-2">{t('settings.install')}</div>
          {installEvent ? (
            <>
              <p className="mb-3 text-sm text-muted">{t('settings.installBlurb')}</p>
              <button
                type="button"
                onClick={promptInstall}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" x2="12" y1="15" y2="3" />
                </svg>
                {t('settings.installCta')}
              </button>
            </>
          ) : ua.ios ? (
            <ol className="flex flex-col gap-2 text-sm text-muted">
              <li>1. Pulsa el botón de <b>Compartir</b> en Safari (el icono con la flecha hacia arriba)</li>
              <li>2. Desliza y elige <b>Añadir a pantalla de inicio</b></li>
              <li>3. Pulsa <b>Añadir</b> arriba a la derecha</li>
            </ol>
          ) : ua.android ? (
            <ol className="flex flex-col gap-2 text-sm text-muted">
              <li>1. Abre el menú ⋮ en Chrome</li>
              <li>2. Pulsa <b>Instalar aplicación</b> o <b>Añadir a pantalla principal</b></li>
            </ol>
          ) : (
            <ol className="flex flex-col gap-2 text-sm text-muted">
              <li>1. Busca el icono de <b>Instalar</b> a la derecha de la barra de direcciones (parece una pantalla con flecha)</li>
              <li>2. Haz click → <b>Instalar</b></li>
            </ol>
          )}
        </section>
      )}

      {/* Backup */}
      <section className="card mb-4 p-4">
        <div className="section-title mb-2">{t('settings.backup')}</div>
        <p className="mb-3 text-sm text-muted">{t('settings.backupBlurb')}</p>
        <label className={`mb-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-elevated/40 px-4 py-2.5 text-sm font-medium transition hover:border-strong ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          {importing ? t('settings.importing') : t('settings.import')}
          <input
            type="file"
            accept=".fitnotes,.db,.sqlite,application/x-sqlite3"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
            }}
          />
        </label>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition hover:border-strong hover:bg-elevated disabled:opacity-40"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" x2="12" y1="15" y2="3" />
          </svg>
          {exporting ? t('settings.exporting') : t('settings.export')}
        </button>
      </section>

      <button
        type="button"
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-medium text-danger transition hover:bg-danger/20"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
        {t('settings.signOut')}
      </button>
    </>
  );
}
