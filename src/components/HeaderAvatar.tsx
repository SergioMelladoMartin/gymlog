import { useEffect, useRef, useState } from 'react';
import { getCurrentUser, signOut, type UserProfile } from '../lib/auth';
import { useT } from '../hooks/useT';
import BottomSheet from './ui/BottomSheet';

/**
 * Mobile-only avatar button in the header (top-right, next to the sync
 * pill). Opens a small dropdown menu (Profile / Settings / Sign out).
 * On desktop the sidebar already shows the avatar + these links, so this
 * component renders nothing there.
 *
 * The menu itself is portalled to <body> — the header is a `glass-bar`
 * (backdrop-filter), which becomes a containing block for `position: fixed`
 * descendants, trapping a fixed/absolute-positioned dropdown inside the
 * header's own stacking context instead of floating over the page.
 */
export default function HeaderAvatar() {
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  const [user, setUser] = useState<UserProfile | null>(null);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
    setUser(getCurrentUser());
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  if (!mounted || isDesktop) return null;

  const userName = user?.name ?? 'Usuario';
  const initial = (userName || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('menu.openUserMenu')}
        aria-expanded={open}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full active:scale-95"
      >
        {user?.picture ? (
          <img src={user.picture} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-ink">{initial}</span>
        )}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div role="menu" className="flex flex-col py-1 text-sm">
          <a href="/profile" role="menuitem" className="flex items-center px-5 py-3 text-fg transition hover:bg-elevated active:scale-[0.99]">
            {t('menu.profile')}
          </a>
          <a href="/settings" role="menuitem" className="flex items-center px-5 py-3 text-fg transition hover:bg-elevated active:scale-[0.99]">
            {t('menu.settings')}
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); signOut().finally(() => { location.href = '/login'; }); }}
            className="flex w-full items-center px-5 py-3 text-left text-danger transition hover:bg-danger/10 active:scale-[0.99]"
          >
            {t('menu.logout')}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
