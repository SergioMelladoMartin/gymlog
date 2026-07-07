// Secondary local persistence for the FitNotes blob. OPFS is the primary
// store; IndexedDB is a best-effort mirror so a browser storage eviction
// on one layer doesn't wipe the user's workouts.

const DB_NAME = 'gymlog-local-backup';
const STORE = 'files';
const KEY = 'fitnotes';

type BackupRow = { bytes: Uint8Array; hash: string; at: number };

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: BackupRow): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Mirror bytes to IndexedDB (fire-and-forget safe). */
export async function backupWrite(bytes: Uint8Array): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    const hash = await hashBytes(bytes);
    await idbPut(db, KEY, { bytes, hash, at: Date.now() });
    db.close();
  } catch (e) {
    console.warn('[backup] write failed', e);
  }
}

/** Read the mirrored copy when OPFS is empty or unreadable. */
export async function backupRead(): Promise<Uint8Array | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const row = await idbGet<BackupRow>(db, KEY);
    db.close();
    return row?.bytes ?? null;
  } catch (e) {
    console.warn('[backup] read failed', e);
    return null;
  }
}

export async function backupDelete(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}
