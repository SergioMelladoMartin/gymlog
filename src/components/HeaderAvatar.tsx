import { useEffect, useState } from 'react';
import { getCurrentUser, onAuthChange, type UserProfile } from '../lib/auth';
import { useT } from '../hooks/useT';

/** Profile shortcut in the mobile header (the desktop sidebar has its own). */
export default function HeaderAvatar() {
  const { t } = useT();
  const [user, setUser] = useState<UserProfile | null>(() => getCurrentUser());

  useEffect(() => onAuthChange(() => setUser(getCurrentUser())), []);

  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  return (
    <a
      href="/profile"
      aria-label={t('nav.profile')}
      title={t('nav.profile')}
      className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-elevated/60 lg:hidden"
    >
      {user?.picture ? (
        <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-xs font-bold">{initial}</span>
      )}
    </a>
  );
}
