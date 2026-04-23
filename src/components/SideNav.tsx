import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentUser, signOut, type UserProfile } from '../lib/auth';
import { importBytes, resetLocal, scheduleSync } from '../lib/sqlite';

type NavKey = 'today' | 'calendar' | 'diary' | 'stats' | 'exercises';

interface Props {
  active: NavKey;
}

interface Item { key: NavKey; href: string; label: string; icon: JSX.Element }

const ITEMS: Item[] = [
  {
    key: 'today', href: '/', label: 'Hoy',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" />
        <path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" />
      </svg>
    ),
  },
  {
    key: 'calendar', href: '/calendar', label: 'Calendario',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
      </svg>
    ),
  },
  {
    key: 'diary', href: '/diary', label: 'Diario',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    key: 'exercises', href: '/exercises', label: 'Ejercicios',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" />
        <path d="M3 10v4" /><path d="M21 10v4" />
        <path d="M6.5 6.5v11" /><path d="M17.5 6.5v11" />
      </svg>
    ),
  },
  {
    key: 'stats', href: '/stats', label: 'Estadísticas',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" />
      </svg>
    ),
  },
];

const ACCENTS: Array<{ key: string; label: string; swatch: string }> = [
  { key: 'lime',   label: 'Lima',   swatch: '#a3e635' },
  { key: 'rose',   label: 'Rosa',   swatch: '#f472b6' },
  { key: 'red',    label: 'Rojo',   swatch: '#f87171' },
  { key: 'sky',    label: 'Azul',   swatch: '#7dd3fc' },
  { key: 'violet', label: 'Violeta',swatch: '#c4b5fd' },
  { key: 'mono',   label: 'Mono',   swatch: '#888888' },
];

export default function SideNav({ active }: Props) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [accent, setAccent] = useState<string>('lime');
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'dark';
    setTheme(t);
    const a = document.documentElement.getAttribute('data-accent') || 'lime';
    setAccent(a);
    setUser(getCurrentUser());

    // Desktop = always-open sidebar, no backdrop, no body scroll lock.
    // On mobile the drawer behaves as before (hamburger + overlay).
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Reflect the desktop state on <html> so the Layout can shift its main
  // column via a CSS rule without having to thread props around.
  useEffect(() => {
    document.documentElement.classList.toggle('has-sidenav', isDesktop);
  }, [isDesktop]);

  function setAccentColor(next: string) {
    if (next === 'lime') document.documentElement.removeAttribute('data-accent');
    else document.documentElement.setAttribute('data-accent', next);
    try { localStorage.setItem('accent', next); } catch {}
    setAccent(next);
  }

  // Only lock body scroll on mobile while the drawer is open.
  useEffect(() => {
    if (isDesktop || !open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, isDesktop]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
    setTheme(next);
  }

  async function logout() {
    await signOut();
    await resetLocal();
    window.location.replace('/login');
  }

  async function handleImport(file: File) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await importBytes(bytes);
      await scheduleSync(true);
      window.location.reload();
    } catch (e: any) {
      alert(e?.message ?? 'Error al importar backup');
    }
  }

  const userName = user?.name ?? 'Usuario';
  const userEmail = user?.email ?? '';
  const initial = (userName || userEmail || '?').trim().charAt(0).toUpperCase();

  // On desktop the drawer is always open, permanent, and does not need a
  // backdrop. Mobile keeps the slide-in overlay behaviour.
  const visible = isDesktop || open;
  const drawerStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100dvh',
    width: isDesktop ? '260px' : 'min(320px, 85vw)',
    background: 'var(--color-card)',
    borderRight: '1px solid var(--color-border)',
    boxShadow: isDesktop ? 'none' : '0 10px 40px -8px rgba(0, 0, 0, 0.55)',
    transform: visible ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 60,
  };

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.5)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 55,
    opacity: !isDesktop && open ? 1 : 0,
    pointerEvents: !isDesktop && open ? 'auto' : 'none',
    transition: 'opacity 200ms ease-out',
  };

  const drawerOverlay = (
    <>
      <div style={backdropStyle} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside style={drawerStyle} aria-hidden={!open}>
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-4">
          <a
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
            onClick={() => setOpen(false)}
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.4 14.4 9.6 9.6" />
                <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
                <path d="m21.5 21.5-1.4-1.4" />
                <path d="M3.9 3.9 2.5 2.5" />
                <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
              </svg>
            </span>
            <span>gymlog</span>
          </a>
          {!isDesktop && (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:text-fg"
              aria-label="Cerrar menú"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
            </button>
          )}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
          {ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-accent text-ink' : 'text-fg hover:bg-elevated'
                }`}
              >
                <span className={isActive ? '' : 'text-muted'}>{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <a href="/profile" onClick={() => !isDesktop && setOpen(false)}
            className="mb-2 flex items-center gap-2.5 rounded-lg bg-elevated/60 px-3 py-2 transition hover:bg-elevated">
            {user?.picture ? (
              <img
                src={user.picture}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-ink">{initial}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{userName}</div>
              <div className="truncate text-[11px] text-muted">{userEmail}</div>
            </div>
            <svg className="shrink-0 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </a>

          <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg transition hover:bg-elevated">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" x2="12" y1="3" y2="15" />
            </svg>
            Importar backup
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

          <div className="mb-2 rounded-lg bg-elevated/40 px-3 py-2.5">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Color</div>
            <div className="flex gap-1.5">
              {ACCENTS.map((a) => {
                const isActive = accent === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setAccentColor(a.key)}
                    title={a.label}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full transition ${isActive ? 'ring-2 ring-fg ring-offset-2 ring-offset-elevated' : 'opacity-70 hover:opacity-100'}`}
                    style={{ background: a.swatch }}
                  >
                    {isActive && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg transition hover:bg-elevated"
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
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger transition hover:bg-danger/10"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" x2="9" y1="12" y2="12" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );

  return (
    <>
      {/* Hamburger only on mobile — desktop has the sidebar pinned. */}
      {!isDesktop && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-fg transition hover:bg-elevated"
          aria-label="Abrir menú"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
        </button>
      )}
      {mounted ? createPortal(drawerOverlay, document.body) : null}
    </>
  );
}
