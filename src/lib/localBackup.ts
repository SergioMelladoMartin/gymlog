/**
 * IndexedDB mirror of the OPFS-persisted SQLite bytes.
 *
 * OPFS is the primary local store, but it has been observed to get cleared
 * on iOS Safari / some Chrome installs under storage pressure even with
 * `navigator.storage.persist()` granted. IndexedDB is a second, independent
 * storage bucket — keeping a copy there costs one extra write per save and
 * gives us a fallback to restore from if OPFS ever comes back empty.
 *
 * This module knows nothing about journals, conflicts, or Drive sync — it
 * is a dumb byte mirror, called from sqlite.ts's opfsWrite/opfsRead.
 */

const DB_NAME = 'gymlog-backup';
const STORE = 'files';
const KEY = 'gymlog.fitnotes';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Best-effort: mirror the given bytes into IndexedDB. Never throws. */
export async function backupBytes(bytes: Uint8Array): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(bytes, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (e) {
    console.error('[localBackup] write failed', e);
  }
}

/** Best-effort: read the last mirrored bytes back, or null if none exist. */
export async function restoreBytes(): Promise<Uint8Array | null> {
  try {
    const db = await openDb();
    const bytes = await new Promise<Uint8Array | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return bytes;
  } catch (e) {
    console.error('[localBackup] read failed', e);
    return null;
  }
}
