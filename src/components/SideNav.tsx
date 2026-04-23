import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCurrentUser, type UserProfile } from '../lib/auth';
import { getStatus, onStatusChange } from '../lib/sqlite';
import { getWeeklyStreak } from '../lib/queries';
import { useT } from '../hooks/useT';

type NavKey = 'today' | 'calendar' | 'diary' | 'stats' | 'exercises';

interface Props {
  active: NavKey;
}

interface Item { key: NavKey; href: string; labelKey: string; icon: JSX.Element }

const ITEMS: Item[] = [
  {
    key: 'today', href: '/', labelKey: 'nav.today',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6.5 6.5 11 11" /><path d="m21 21-1-1" /><path d="m3 3 1 1" />
        <path d="m18 22 4-4" /><path d="m2 6 4-4" /><path d="m3 10 7-7" /><path d="m14 21 7-7" />
      </svg>
    ),
  },
  {
    key: 'calendar', href: '/calendar', labelKey: 'nav.calendar',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="4" rx="2" />
        <path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
      </svg>
    ),
  },
  {
    key: 'diary', href: '/diary', labelKey: 'nav.diary',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
  },
  {
    key: 'exercises', href: '/exercises', labelKey: 'nav.exercises',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5h11" /><path d="M6.5 17.5h11" />
        <path d="M3 10v4" /><path d="M21 10v4" />
        <path d="M6.5 6.5v11" /><path d="M17.5 6.5v11" />
      </svg>
    ),
  },
  {
    key: 'stats', href: '/stats', labelKey: 'nav.stats',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="m7 14 4-4 4 4 5-5" />
      </svg>
    ),
  },
];

export default function SideNav({ active }: Props) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  // Initialise both `mounted` and `isDesktop` synchronously on the client so
  // the very first render matches the eventual post-effect state. Without
  // this the drawer flashes closed for one paint on every navigation —
  // especially noticeable on desktop where the bar then "pops in".
  const [mounted, setMounted] = useState(() => typeof window !== 'undefined');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const [collapsed, setCollapsed] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('sidenav-collapsed') === '1'; } catch { return false; }
  });

  const [streak, setStreak] = useState(0);

  // Compute the weekly streak whenever the DB finishes loading, after a
  // remote swap, and whenever the user logs a set (day-level mutations
  // bump the stored last-sync timestamp which we can listen to).
  useEffect(() => {
    function refresh() {
      if (getStatus().status === 'ready') {
        try { setStreak(getWeeklyStreak()); } catch { setStreak(0); }
      } else {
        setStreak(0);
      }
    }
    refresh();
    const offStatus = onStatusChange(() => refresh());
    const onSwap = () => refresh();
    window.addEventListener('gymlog:db-swapped', onSwap);
    // Also recompute every minute so a missed midnight or a set added on
    // another device (pulled on poll) reflects without a full reload.
    const id = setInterval(refresh, 60_000);
    return () => {
      offStatus();
      window.removeEventListener('gymlog:db-swapped', onSwap);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    setMounted(true);
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
          {isDesktop && !isCollapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Replegar"
              aria-label="Replegar barra"
              className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
                <path d="M21 4v16" />
              </svg>
            </button>
          )}
        </div>

        {isDesktop && isCollapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title="Expandir"
            aria-label="Expandir barra"
            className="mx-auto mt-2 grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-fg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
              <path d="M3 4v16" />
            </svg>
          </button>
        )}

        <nav className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${isCollapsed ? 'p-2' : 'p-3'}`}>
          {ITEMS.map((item) => {
            const isActive = item.key === active;
            return (
              <a
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? t(item.labelKey) : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition ${
                  isCollapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${isActive ? 'bg-accent text-ink' : 'text-fg hover:bg-elevated'}`}
              >
                <span className={isActive ? '' : 'text-muted'}>{item.icon}</span>
                {!isCollapsed && t(item.labelKey)}
              </a>
            );
          })}
        </nav>

        <div className={`shrink-0 border-t border-border ${isCollapsed ? 'p-2' : 'p-3'}`}>
          <a
            href="/settings"
            onClick={() => !isDesktop && setOpen(false)}
            title={isCollapsed ? t('nav.settings') : undefined}
            className={`mb-1 flex w-full items-center rounded-lg text-sm text-fg transition hover:bg-elevated ${
              isCollapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
            {!isCollapsed && t('nav.settings')}
          </a>

          <a
            href="/profile"
            onClick={() => !isDesktop && setOpen(false)}
            title={
              isCollapsed
                ? `${userName} — ${t('nav.profile')}${streak > 0 ? ` · 🔥 ${t('profile.streakWeeks', { n: streak })}` : ''}`
                : undefined
            }
            className={`flex items-center rounded-lg bg-elevated/60 transition hover:bg-elevated ${
              isCollapsed ? 'justify-center px-1 py-1.5' : 'gap-2.5 px-3 py-2'
            }`}
          >
            <span className="relative shrink-0">
              {streak > 0 && (
                <span
                  className="absolute -right-1 -top-1 z-10 inline-flex items-center gap-0.5 rounded-full border border-card bg-accent px-1 py-[1px] text-[9px] font-bold leading-none text-ink shadow-sm"
                  title={`🔥 ${t('profile.streakWeeks', { n: streak })}`}
                  aria-label={`🔥 ${t('profile.streakWeeks', { n: streak })}`}
                >
                  🔥{streak}
                </span>
              )}
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
            </span>
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
