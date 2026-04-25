// Google Drive appdata helpers for the raw FitNotes SQLite file.
// Keeps a single `gymlog.fitnotes` blob in the hidden appData folder.

import { getAccessToken, reconsent } from './auth';

const FILE_NAME = 'gymlog.fitnotes';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// File ID cache survives across sessions so the very first push doesn't
// have to spend a round-trip on `findFile()`. Drive returns the same id
// for the lifetime of the file, so storing it locally is safe — the
// worst case is the file got deleted on the server, in which case our
// PATCH 404s and we fall back to find/create.
const LS_FILE_ID = 'gymlog-drive-file-id';
let cachedFileId: string | null = (() => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(LS_FILE_ID) : null; } catch { return null; }
})();
function setCachedFileId(id: string | null) {
  cachedFileId = id;
  try {
    if (id) localStorage.setItem(LS_FILE_ID, id);
    else localStorage.removeItem(LS_FILE_ID);
  } catch {}
}

// Drive operations occasionally hang on flaky mobile networks; without a
// timeout the inFlight promise in sqlite.ts could pin the sync state to
// "syncing" forever and block subsequent flushes. 30s is plenty for a
// 200KB upload and short enough that we can recover by retrying.
const DRIVE_TIMEOUT_MS = 30_000;

async function timedFetch(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), DRIVE_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function authHeaders(extra: Record<string, string> = {}): Promise<Headers> {
  const token = await getAccessToken();
  const h = new Headers(extra);
  h.set('Authorization', `Bearer ${token}`);
  return h;
}

async function findFile(retryOn403 = true): Promise<{ id: string; modifiedTime: string; size: number } | null> {
  const headers = await authHeaders();
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: 'files(id, modifiedTime, size)',
    pageSize: '1',
  });
  const res = await timedFetch(`${DRIVE_API}/files?${params}`, { headers });
  if (res.status === 403 && retryOn403) {
    // Token lacks drive.appdata. Re-prompt for consent with the Drive
    // checkbox and try once more.
    await reconsent();
    return findFile(false);
  }
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? 'Google rechazó el acceso a Drive. Asegúrate de haber añadido el scope `drive.appdata` en tu OAuth consent screen y de haber marcado la casilla al iniciar sesión.'
        : `drive list failed: ${res.status}`,
    );
  }
  const data = await res.json();
  const file = data.files?.[0];
  if (!file) return null;
  setCachedFileId(file.id);
  return { id: file.id, modifiedTime: file.modifiedTime, size: Number(file.size ?? 0) };
}

/** Returns null when no backup exists yet in Drive. */
export async function pullBlobFromDrive(): Promise<ArrayBuffer | null> {
  const file = await findFile();
  if (!file) return null;
  const headers = await authHeaders();
  const res = await timedFetch(`${DRIVE_API}/files/${file.id}?alt=media`, { headers });
  if (!res.ok) throw new Error(`drive download failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function getRemoteMeta() {
  return findFile();
}

async function createFile(bytes: Uint8Array): Promise<{ id: string; modifiedTime: string; size: number }> {
  const headers = await authHeaders();
  const boundary = 'gymlog-' + Math.random().toString(36).slice(2);
  const metadata = {
    name: FILE_NAME,
    parents: ['appDataFolder'],
    mimeType: 'application/vnd.sqlite3',
  };

  const encoder = new TextEncoder();
  const preamble = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\nContent-Type: application/vnd.sqlite3\r\n\r\n`,
  );
  const closing = encoder.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(preamble.length + bytes.length + closing.length);
  body.set(preamble, 0);
  body.set(bytes, preamble.length);
  body.set(closing, preamble.length + bytes.length);

  headers.set('Content-Type', `multipart/related; boundary=${boundary}`);
  // Ask Drive to echo the new modifiedTime/size in the response so we
  // don't need a separate findFile() round-trip after a push.
  const res = await timedFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,modifiedTime,size`, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) throw new Error(`drive create failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  setCachedFileId(data.id);
  return { id: data.id, modifiedTime: data.modifiedTime, size: Number(data.size ?? 0) };
}

async function updateFile(fileId: string, bytes: Uint8Array): Promise<{ id: string; modifiedTime: string; size: number }> {
  const headers = await authHeaders();
  headers.set('Content-Type', 'application/vnd.sqlite3');
  const res = await timedFetch(`${UPLOAD_API}/files/${fileId}?uploadType=media&fields=id,modifiedTime,size`, {
    method: 'PATCH',
    headers,
    body: bytes,
  });
  if (!res.ok) throw new Error(`drive update failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, modifiedTime: data.modifiedTime, size: Number(data.size ?? 0) };
}

/** Push the bytes to Drive. Returns the new file metadata so the caller
 *  can update its stored sync watermark in one go (no extra round-trip).
 *  Tries the cached file id first to avoid a `findFile()` request — falls
 *  back to find/create if the file got deleted on the server. */
export async function pushBlobToDrive(
  bytes: Uint8Array,
): Promise<{ id: string; modifiedTime: string; size: number }> {
  if (cachedFileId) {
    try {
      return await updateFile(cachedFileId, bytes);
    } catch (e: any) {
      // 404 → file vanished from Drive; clear cache and fall through.
      // Other errors (timeout, 5xx) bubble up.
      const msg = e?.message ?? '';
      if (!/404|not.?found/i.test(msg)) throw e;
      setCachedFileId(null);
    }
  }
  const existing = await findFile();
  if (existing) return updateFile(existing.id, bytes);
  return createFile(bytes);
}

/** Permanently delete the gymlog.fitnotes file from the user's Drive
 *  appdata folder. No-op (resolves false) if no file exists. Returns true
 *  when something was actually removed. */
export async function deleteBlobFromDrive(): Promise<boolean> {
  const existing = await findFile();
  if (!existing) return false;
  const headers = await authHeaders();
  const res = await timedFetch(`${DRIVE_API}/files/${existing.id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`drive delete failed: ${res.status} ${await res.text()}`);
  }
  setCachedFileId(null);
  return true;
}

export function clearCache() {
  setCachedFileId(null);
}
