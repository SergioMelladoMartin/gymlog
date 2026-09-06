import { useEffect, useState } from 'react';
import { getStatus, loadDatabase, onStatusChange } from '../lib/sqlite';
import { hasSession } from '../lib/auth';

export interface DatabaseState {
  ready: boolean;
  /** Increments when the in-memory DB is hot-swapped from Drive. */
  revision: number;
}

/**
 * Boots the SQLite database on first use (OPFS → Drive → seed fallback)
 * and returns readiness + a revision counter for remote hot-swaps.
 */
export function useDatabase(): DatabaseState {
  const [status, setStatus] = useState(getStatus().status);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const off = onStatusChange(setStatus);
    if (status === 'idle') {
      loadDatabase({ seedUrl: import.meta.env.DEV ? '/seed.fitnotes' : undefined }).catch(console.error);
    }
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === 'empty' && !hasSession() && typeof window !== 'undefined') {
      window.location.replace('/login');
    }
  }, [status]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onSwap = () => setRevision((r) => r + 1);
    window.addEventListener('gymlog:db-swapped', onSwap);
    return () => window.removeEventListener('gymlog:db-swapped', onSwap);
  }, []);

  return { ready: status === 'ready', revision };
}
