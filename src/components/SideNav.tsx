import { useEffect, useState } from 'react';
import { getCurrentUser, type UserProfile } from '../lib/auth';
import { getStatus, onStatusChange } from '../lib/sqlite';
import { getWeeklyStreak } from '../lib/queries';
import { useT } from '../hooks/useT';
import { NAV_ITEMS, type NavKey } from './navItems';

interface Props {
  active: NavKey | 'profile' | 'settings';
}

export default function SideNav({ active }: Props) {
  const { t } = useT();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return typeof window !== 'undefined' && localStorage.getItem('sidenav-collapsed') === '1'; } catch { return false; }
  });
  const [streak, setStreak] = useState(0);

  // Compute the weekly streak whenever the DB finishes loading, after a
  // remote swap, and once a minute (missed midnight, sets pulled on poll).
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
    window.addEventListener('gymlog:db-swapped', refresh);
    const id = setInterval(refresh, 60_000);
    return () => {
      offStatus();
      window.removeEventListener('gymlog:db-swapped', refresh);
      clearInterval(id);
    };
  }, []);

  useEffect(() => { setUser(getCurrentUser()); }, []);

  // The body carries `data-sidenav` from the SSR'd layout; the collapsed
  // padding only applies at >= 1024px (see global.css).
  useEffect(() => {
    document.body.classList.toggle('sidenav-collapsed', collapsed);
  }, [collapsed]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem('sidenav-collapsed', next ? '1' : '0');
        (window as any).__gymlogSidenavCollapsed = next;
      } catch {}
      return next;
    });
  }

  const userName = user?.name ?? t('common.user');
  const userEmail = user?.email ?? '';
  const initial = (userName || userEmail || '?').trim().charAt(0).toUpperCase();

  // Desktop only: phones and tablets get the bottom TabBar instead.
  return (
    <aside
      data-sidebar
      className="fixed left-0 top-0 z-[60] hidden h-dvh flex-col border-r border-border lg:flex"
      style={{
        width: collapsed ? '72px' : '260px',
        background: 'color-mix(in srgb, var(--color-bg) 55%, transparent)',
        backdropFilter: 'blur(24px) saturate(var(--glass-saturate))',
        WebkitBackdropFilter: 'blur(24px) saturate(var(--glass-saturate))',
        transition: 'width 200ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    >
      <div className={`flex shrink-0 items-center border-b border-border py-4 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight" title={collapsed ? 'gymlog' : undefined}>
          <span className="btn-accent accent-glow grid h-8 w-8 place-items-center rounded-lg">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.4 14.4 9.6 9.6" />
                <path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z" />
                <path d="m21.5 21.5-1.4-1.4" />
                <path d="M3.9 3.9 2.5 2.5" />
                <path d="M6.404 12.768a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829l2.828-2.828a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829z" />
            </svg>
          </span>
          {!collapsed && <span>gymlog</span>}
        </a>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            title={t('action.collapseNav')}
            aria-label={t('action.collapseNav')}
            className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-fg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
              <path d="M21 4v16" />
            </svg>
          </button>
        )}
      </div>

      {collapsed && (
        <button
          type="button"
          onClick={toggleCollapsed}
          title={t('action.expandNav')}
          aria-label={t('action.expandNav')}
          className="mx-auto mt-2 grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-elevated hover:text-fg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6" />
            <path d="M3 4v16" />
          </svg>
        </button>
      )}

      <nav className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${collapsed ? 'p-2' : 'p-3'}`}>
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <a
              key={item.key}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? t(item.labelKey) : undefined}
              className={`flex items-center rounded-xl text-sm font-medium transition ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${isActive ? 'btn-accent accent-glow' : 'text-fg hover:bg-elevated/70'}`}
            >
              <span className={isActive ? '' : 'text-muted'}>{item.icon(18)}</span>
              {!collapsed && t(item.labelKey)}
            </a>
          );
        })}
      </nav>

      <div className={`shrink-0 border-t border-border ${collapsed ? 'p-2' : 'p-3'}`}>
        <a
          href="/settings"
          aria-current={active === 'settings' ? 'page' : undefined}
          title={collapsed ? t('nav.settings') : undefined}
          className={`mb-1 flex w-full items-center rounded-lg text-sm transition hover:bg-elevated ${
            collapsed ? 'justify-center px-0 py-2' : 'gap-2 px-3 py-2'
          } ${active === 'settings' ? 'bg-elevated text-fg' : 'text-fg'}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          {!collapsed && t('nav.settings')}
        </a>

        <a
          href="/profile"
          aria-current={active === 'profile' ? 'page' : undefined}
          title={
            collapsed
              ? `${userName} — ${t('nav.profile')}${streak > 0 ? ` · 🔥 ${t('profile.streakWeeks', { n: streak })}` : ''}`
              : undefined
          }
          className={`flex items-center rounded-lg bg-elevated/60 transition hover:bg-elevated ${
            collapsed ? 'justify-center px-1 py-1.5' : 'gap-2.5 px-3 py-2'
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
              <img src={user.picture} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-ink">{initial}</span>
            )}
          </span>
          {!collapsed && (
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
  );
}
