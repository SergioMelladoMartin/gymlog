// Google Drive appdata helpers for the raw FitNotes SQLite file.
// Keeps a single `gymlog.fitnotes` blob in the hidden appData folder.

import { getAccessToken, reconsent } from './auth';

const FILE_NAME = 'gymlog.fitnotes';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

let cachedFileId: string | null = null;

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
  const res = await fetch(`${DRIVE_API}/files?${params}`, { headers });
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
  cachedFileId = file.id;
  return { id: file.id, modifiedTime: file.modifiedTime, size: Number(file.size ?? 0) };
}

/** Returns null when no backup exists yet in Drive. */
export async function pullBlobFromDrive(): Promise<ArrayBuffer | null> {
  const file = await findFile();
  if (!file) return null;
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files/${file.id}?alt=media`, { headers });
  if (!res.ok) throw new Error(`drive download failed: ${res.status}`);
  return res.arrayBuffer();
}

export async function getRemoteMeta() {
  return findFile();
}

async function createFile(bytes: Uint8Array): Promise<string> {
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
  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
    method: 'POST',
    headers,
    body,
  });
  if (!res.ok) throw new Error(`drive create failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedFileId = data.id;
  return data.id;
}

async function updateFile(fileId: string, bytes: Uint8Array): Promise<void> {
  const headers = await authHeaders();
  headers.set('Content-Type', 'application/vnd.sqlite3');
  const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers,
    body: bytes,
  });
  if (!res.ok) throw new Error(`drive update failed: ${res.status} ${await res.text()}`);
}

export async function pushBlobToDrive(bytes: Uint8Array): Promise<void> {
  const existing = await findFile();
  if (existing) await updateFile(existing.id, bytes);
  else await createFile(bytes);
}

/** Permanently delete the gymlog.fitnotes file from the user's Drive
 *  appdata folder. No-op (resolves false) if no file exists. Returns true
 *  when something was actually removed. */
export async function deleteBlobFromDrive(): Promise<boolean> {
  const existing = await findFile();
  if (!existing) return false;
  const headers = await authHeaders();
  const res = await fetch(`${DRIVE_API}/files/${existing.id}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`drive delete failed: ${res.status} ${await res.text()}`);
  }
  cachedFileId = null;
  return true;
}

export function clearCache() {
  cachedFileId = null;
}
