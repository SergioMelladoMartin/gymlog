import { useEffect, useState } from 'react';
import { getStatus, loadDatabase, onStatusChange } from '../lib/sqlite';
import { isSignedIn } from '../lib/auth';

/**
 * Boots the SQLite database on first use (OPFS → Drive → seed fallback)
 * and returns `true` once the db is ready to be queried. Any protected
 * page can just do `if (!useDatabase()) return <spinner/>`.
 */
export function useDatabase(): boolean {
  const [status, setStatus] = useState(getStatus().status);

  useEffect(() => {
    const off = onStatusChange(setStatus);
    if (status === 'idle') {
      loadDatabase({ seedUrl: '/seed.fitnotes' }).catch(console.error);
    }
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'empty' && !isSignedIn() && typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }, [status]);

  // If another device pushes an update to Drive while this tab is open, the
  // in-memory db gets hot-swapped. Reload so every view re-runs its queries
  // against the fresh data.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSwap = () => window.location.reload();
    window.addEventListener('gymlog:db-swapped', onSwap);
    return () => window.removeEventListener('gymlog:db-swapped', onSwap);
  }, []);

  return status === 'ready';
}
