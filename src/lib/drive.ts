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
// timeout a sync round could pin the state to "syncing" forever. Metadata
// calls are tiny, so fail fast and let the retry loop try again. Uploads
// scale with the file size: a weak gym signal can manage ~15 KB/s, and a
// timeout shorter than the transfer would mean the push never lands.
const META_TIMEOUT_MS = 15_000;
const MIN_TRANSFER_TIMEOUT_MS = 30_000;
const MAX_TRANSFER_TIMEOUT_MS = 180_000;

function transferTimeout(bytes: number): number {
  return Math.min(MAX_TRANSFER_TIMEOUT_MS, MIN_TRANSFER_TIMEOUT_MS + Math.ceil(bytes / 15_000) * 1000);
}

export type RemoteFile = { id: string; modifiedTime: string; size: number; md5: string | null };

/** True for failures caused by the connection (offline, DNS, timeout) rather
 *  than by Drive rejecting the request. Those are retried quietly. */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const err = e as { name?: string } | null;
  return err?.name === 'AbortError' || err?.name === 'TimeoutError' || e instanceof TypeError;
}

async function timedFetch(input: RequestInfo, init: RequestInit = {}, timeoutMs = META_TIMEOUT_MS): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
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

function toRemoteFile(data: any): RemoteFile {
  return {
    id: data.id,
    modifiedTime: data.modifiedTime,
    size: Number(data.size ?? 0),
    md5: typeof data.md5Checksum === 'string' ? data.md5Checksum.toLowerCase() : null,
  };
}

const FILE_FIELDS = 'id,modifiedTime,size,md5Checksum';

async function findFile(retryOn403 = true): Promise<RemoteFile | null> {
  const headers = await authHeaders();
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: `files(${FILE_FIELDS})`,
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
  return toRemoteFile(file);
}

/** Returns null when no backup exists yet in Drive. Pass the metadata from a
 *  previous `getRemoteMeta()` to skip a second lookup round-trip. */
export async function pullBlobFromDrive(known?: RemoteFile): Promise<ArrayBuffer | null> {
  const file = known ?? await findFile();
  if (!file) return null;
  const headers = await authHeaders();
  const res = await timedFetch(`${DRIVE_API}/files/${file.id}?alt=media`, { headers }, transferTimeout(file.size));
  if (!res.ok) throw new Error(`drive download failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function getRemoteMeta() {
  return findFile();
}

async function createFile(bytes: Uint8Array): Promise<RemoteFile> {
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
  const res = await timedFetch(`${UPLOAD_API}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
    method: 'POST',
    headers,
    body,
  }, transferTimeout(bytes.byteLength));
  if (!res.ok) throw new Error(`drive create failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  setCachedFileId(data.id);
  return toRemoteFile(data);
}

async function updateFile(fileId: string, bytes: Uint8Array): Promise<RemoteFile> {
  const headers = await authHeaders();
  headers.set('Content-Type', 'application/vnd.sqlite3');
  const res = await timedFetch(`${UPLOAD_API}/files/${fileId}?uploadType=media&fields=${FILE_FIELDS}`, {
    method: 'PATCH',
    headers,
    body: bytes,
  }, transferTimeout(bytes.byteLength));
  if (!res.ok) throw new Error(`drive update failed: ${res.status} ${await res.text()}`);
  return toRemoteFile(await res.json());
}

/** Push the bytes to Drive. Returns the new file metadata so the caller
 *  can update its stored sync watermark in one go (no extra round-trip).
 *  Tries the cached file id first to avoid a `findFile()` request — falls
 *  back to find/create if the file got deleted on the server. */
export async function pushBlobToDrive(bytes: Uint8Array): Promise<RemoteFile> {
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
