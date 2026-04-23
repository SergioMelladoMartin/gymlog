import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentUser, type UserProfile } from '../lib/auth';

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

export default function SideNav({ active }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setUser(getCurrentUser());
    try {
      setCollapsed(localStorage.getItem('sidenav-collapsed') === '1');
    } catch {}

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

  useEffect(() => {
    document.documentElement.classList.toggle('sidenav-collapsed', isDesktop && collapsed);
  }, [isDesktop, collapsed]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('sidenav-collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
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
    width: isDesktop ? (collapsed ? '72px' : '260px') : 'min(320px, 85vw)',
    background: 'var(--color-card)',
    borderRight: '1px solid var(--color-border)',
    boxShadow: isDesktop ? 'none' : '0 10px 40px -8px rgba(0, 0, 0, 0.55)',
    transform: visible ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 200ms cubic-bezier(0.2, 0.8, 0.2, 1), width 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
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

  const isCollapsed = isDesktop && collapsed;

  const drawerOverlay = (
    <>
      <div style={backdropStyle} onClick={() => setOpen(false)} aria-hidden="true" />

      <aside style={drawerStyle} aria-hidden={!open}>
        <div className={`flex shrink-0 items-center border-b border-border py-4 ${isCollapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
          <a
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
            onClick={() => setOpen(false)}
            title={isCollapsed ? 'gymlog' : undefined}
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
            {!isCollapsed && <span>gymlog</span>}
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

        <nav className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${isCollapsed ? 'p-2' : 'p-3'}`}>
          {ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition ${
                  isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${isActive ? 'bg-accent text-ink' : 'text-fg hover:bg-elevated'}`}
              >
                <span className={isActive ? '' : 'text-muted'}>{item.icon}</span>
                {!isCollapsed && item.label}
              </a>
            );
          })}
        </nav>

        <div className={`shrink-0 border-t border-border ${isCollapsed ? 'p-2' : 'p-3'}`}>
          <a
            href="/profile"
            onClick={() => !isDesktop && setOpen(false)}
            title={isCollapsed ? `${userName} — Perfil` : undefined}
            className={`mb-2 flex items-center rounded-lg bg-elevated/60 transition hover:bg-elevated ${
              isCollapsed ? 'justify-center px-1 py-1.5' : 'gap-2.5 px-3 py-2'
            }`}
          >
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
            {!isCollapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{userName}</div>
                  <div className="truncate text-[11px] text-muted">{userEmail}</div>
                </div>
                <svg className="shrink-0 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
              </>
            )}
          </a>

          <a
            href="/settings"
            onClick={() => !isDesktop && setOpen(false)}
            title={isCollapsed ? 'Ajustes' : undefined}
            className={`flex w-full items-center rounded-lg text-sm text-fg transition hover:bg-elevated ${
              isCollapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {!isCollapsed && 'Ajustes'}
          </a>

          {isDesktop && (
            <button
              type="button"
              onClick={toggleCollapsed}
              title={collapsed ? 'Expandir' : 'Replegar'}
              aria-label={collapsed ? 'Expandir barra' : 'Replegar barra'}
              className={`mt-1 flex w-full items-center rounded-lg text-sm text-muted transition hover:bg-elevated hover:text-fg ${
                isCollapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
              }`}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {collapsed ? (
                  <>
                    <path d="m9 18 6-6-6-6" />
                    <path d="M3 4v16" />
                  </>
                ) : (
                  <>
                    <path d="m15 18-6-6 6-6" />
                    <path d="M21 4v16" />
                  </>
                )}
              </svg>
              {!isCollapsed && 'Replegar'}
            </button>
          )}
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
