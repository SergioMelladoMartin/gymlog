// Browser-side SQLite over the native FitNotes file.
//
//   [Drive]  ← blob sync (debounced)
//     ↓↑
//   [OPFS]   — working copy, persists across sessions
//     ↓↑
//   [WASM]   — @sqlite.org/sqlite-wasm running in a web worker
//
// The database is the literal FitNotes `.fitnotes` SQLite file, untouched.
// We can round-trip it to the user's phone and back.

import sqlite3InitModule, {
  type Database,
  type Sqlite3Static,
} from '@sqlite.org/sqlite-wasm';
import { pullBlobFromDrive, pushBlobToDrive, getRemoteMeta } from './drive';
import { isSignedIn } from './auth';

const OPFS_NAME = '/gymlog.fitnotes';

type DbStatus = 'idle' | 'loading' | 'ready' | 'error' | 'empty';

let sqlite3: Sqlite3Static | null = null;
let db: Database | null = null;
let status: DbStatus = 'idle';
let statusError: unknown = null;
let statusListeners: Array<(s: DbStatus) => void> = [];

function setStatus(s: DbStatus, err?: unknown) {
  status = s;
  statusError = err ?? null;
  for (const l of statusListeners) l(s);
}

export function getStatus(): { status: DbStatus; error: unknown } {
  return { status, error: statusError };
}

export function onStatusChange(fn: (s: DbStatus) => void): () => void {
  statusListeners.push(fn);
  fn(status);
  return () => { statusListeners = statusListeners.filter((l) => l !== fn); };
}

async function initSqlite(): Promise<Sqlite3Static> {
  if (sqlite3) return sqlite3;
  sqlite3 = await sqlite3InitModule({
    // Silence the noisy load logs.
    print: () => {},
    printErr: (...args: any[]) => console.error('[sqlite]', ...args),
  });
  return sqlite3;
}

function openFromBytes(bytes: Uint8Array): Database {
  const s = sqlite3!;
  const db = new s.oo1.DB();
  const p = s.wasm.allocFromTypedArray(bytes);
  try {
    const rc = s.capi.sqlite3_deserialize(
      db.pointer!,
      'main',
      p,
      bytes.byteLength,
      bytes.byteLength,
      s.capi.SQLITE_DESERIALIZE_RESIZEABLE,
    );
    if (rc !== 0) throw new Error(`sqlite3_deserialize failed: ${rc}`);
  } catch (e) {
    s.wasm.dealloc(p);
    throw e;
  }
  return db;
}

/** Brand-new FitNotes-compatible database with sensible default categories. */
function createEmptyDatabase(): Database {
  const s = sqlite3!;
  const db = new s.oo1.DB();
  db.exec(`
    CREATE TABLE Category (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      colour INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE exercise (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category_id INTEGER NOT NULL,
      exercise_type_id INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      weight_increment INTEGER,
      default_graph_id INTEGER,
      default_rest_time INTEGER,
      weight_unit_id INTEGER NOT NULL DEFAULT 0,
      is_favourite INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE training_log (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_id INTEGER NOT NULL,
      date DATE NOT NULL,
      metric_weight REAL NOT NULL,
      reps INTEGER NOT NULL,
      unit INTEGER NOT NULL DEFAULT 0,
      routine_section_exercise_set_id INTEGER NOT NULL DEFAULT 0,
      timer_auto_start INTEGER NOT NULL DEFAULT 0,
      is_personal_record INTEGER NOT NULL DEFAULT 0,
      is_personal_record_first INTEGER NOT NULL DEFAULT 0,
      is_complete INTEGER NOT NULL DEFAULT 0,
      is_pending_update INTEGER NOT NULL DEFAULT 0,
      distance REAL NOT NULL DEFAULT 0,
      duration_seconds INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE WorkoutComment (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      comment TEXT NOT NULL
    );
    CREATE TABLE BodyWeight (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      body_weight_metric REAL NOT NULL,
      body_fat REAL NOT NULL DEFAULT 0,
      comments TEXT
    );
  `);
  // Default categories with FitNotes-style signed 32-bit ARGB colours.
  const cats: [string, number, number][] = [
    ['Pecho',     -11226442, 1],
    ['Tríceps',   -13330213, 2],
    ['Hombro',     -4179669, 3],
    ['Cardio',     -4342339, 4],
    ['Pierna',   -13877680, 5],
    ['Espalda',  -13710223, 6],
    ['Bíceps',    -6596170, 7],
    ['Core',     -10453621, 8],
    ['Antebrazo', -15294331, 9],
  ];
  for (const [name, colour, sort] of cats) {
    db.exec({ sql: 'INSERT INTO Category (name, colour, sort_order) VALUES (?, ?, ?)', bind: [name, colour, sort] });
  }
  return db;
}

function serialize(db: Database): Uint8Array {
  const s = sqlite3!;
  const bytes = s.capi.sqlite3_js_db_export(db.pointer!);
  return bytes;
}

// ── OPFS persistence ───────────────────────────────────────────────────
async function opfsRead(): Promise<Uint8Array | null> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle(OPFS_NAME.replace(/^\//, ''), { create: false });
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  } catch {
    return null;
  }
}

async function opfsWrite(bytes: Uint8Array): Promise<void> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  const handle = await root.getFileHandle(OPFS_NAME.replace(/^\//, ''), { create: true });
  const w = await (handle as any).createWritable();
  await w.write(bytes);
  await w.close();
}

async function opfsDelete(): Promise<void> {
  if (!('storage' in navigator) || !navigator.storage.getDirectory) return;
  const root = await navigator.storage.getDirectory();
  try { await root.removeEntry(OPFS_NAME.replace(/^\//, '')); } catch {}
}

// ── lifecycle ──────────────────────────────────────────────────────────

export async function loadDatabase(options: { seedUrl?: string } = {}): Promise<void> {
  if (status === 'loading' || status === 'ready') return;
  setStatus('loading');
  try {
    await initSqlite();

    // 1. Prefer a copy already in OPFS (fastest startup).
    let bytes = await opfsRead();

    // 2. Otherwise, pull from Drive if the user is signed in.
    if (!bytes && isSignedIn()) {
      const remote = await pullBlobFromDrive().catch(() => null);
      if (remote) {
        bytes = new Uint8Array(remote);
        await opfsWrite(bytes);
      }
    }

    // 3. Dev fallback — load the bundled seed file.
    if (!bytes && options.seedUrl) {
      const res = await fetch(options.seedUrl).catch(() => null);
      if (res?.ok) {
        bytes = new Uint8Array(await res.arrayBuffer());
        await opfsWrite(bytes);
      }
    }

    if (!bytes) {
      // No local copy, no Drive backup, no seed → start fresh with an empty
      // FitNotes-compatible schema. Push it to Drive immediately so future
      // devices find the same file.
      db = createEmptyDatabase();
      db.exec('PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');
      setStatus('ready');
      scheduleSync(true).catch(() => {});
      return;
    }

    db = openFromBytes(bytes);
    db.exec('PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');
    setStatus('ready');
  } catch (e) {
    console.error('loadDatabase', e);
    setStatus('error', e);
  }
}

/** Replace the in-memory DB with these bytes (user uploaded a backup). */
export async function importBytes(bytes: Uint8Array): Promise<void> {
  await initSqlite();
  if (db) { db.close(); db = null; }
  db = openFromBytes(bytes);
  db.exec('PRAGMA foreign_keys=ON;');
  await opfsWrite(bytes);
  setStatus('ready');
  scheduleSync(true);
}

export function getDb(): Database {
  if (!db) throw new Error('Database not loaded — call loadDatabase() first.');
  return db;
}

// ── sync to Drive (debounced) ──────────────────────────────────────────

let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;

export function markDirty() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => flushToDrive().catch(() => {}), 5000);
}

async function flushToDrive(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!dirty || !db) return;
  if (inFlight) return inFlight;
  if (!isSignedIn()) { dirty = false; return; }
  dirty = false;
  inFlight = (async () => {
    try {
      const bytes = serialize(db!);
      await opfsWrite(bytes);
      await pushBlobToDrive(bytes);
    } catch (e) {
      dirty = true;
      throw e;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

export async function scheduleSync(immediate = false): Promise<void> {
  dirty = true;
  if (immediate) return flushToDrive();
  markDirty();
}

if (typeof window !== 'undefined') {
  const flushNow = () => { if (dirty) flushToDrive().catch(() => {}); };
  window.addEventListener('pagehide', flushNow);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
}

// ── teardown on sign-out ──────────────────────────────────────────────
export async function resetLocal(): Promise<void> {
  if (db) { db.close(); db = null; }
  await opfsDelete();
  setStatus('idle');
}
