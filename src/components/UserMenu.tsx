import { useEffect, useRef, useState } from 'react';

interface Props {
  userName: string;
  userEmail: string;
}

export default function UserMenu({ userName, userEmail }: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
    setTheme(t);
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  }

  async function logout() {
    await fetch('/api/auth/sign-out', { method: 'POST' });
    window.location.href = '/login';
  }

  const initial = (userName || userEmail || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-sm font-semibold transition hover:text-fg"
        aria-label="Menú de usuario"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border px-3 py-3">
            <div className="truncate text-sm font-semibold">{userName}</div>
            <div className="truncate text-xs text-muted">{userEmail}</div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-elevated"
          >
            {theme === 'dark' ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="m17.66 17.66 1.41 1.41" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="m6.34 17.66-1.41 1.41" /><path d="m19.07 4.93-1.41 1.41" /></svg>
                Tema claro
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
                Tema oscuro
              </>
            )}
          </button>

          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-sm text-danger transition hover:bg-elevated"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
