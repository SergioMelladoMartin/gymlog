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
import { deleteBlobFromDrive, pullBlobFromDrive, pushBlobToDrive, getRemoteMeta } from './drive';
import { getAccessToken, isSignedIn } from './auth';

const OPFS_NAME = '/gymlog.fitnotes';
const LS_REMOTE_META = 'gymlog-drive-meta';

type RemoteMeta = { modifiedTime: string; size: number };

function readStoredMeta(): RemoteMeta | null {
  try {
    const raw = localStorage.getItem(LS_REMOTE_META);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function writeStoredMeta(meta: RemoteMeta | null) {
  try {
    if (meta) localStorage.setItem(LS_REMOTE_META, JSON.stringify(meta));
    else localStorage.removeItem(LS_REMOTE_META);
  } catch {}
}

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
    // RESIZEABLE: let SQLite grow the buffer when we INSERT/ALTER.
    // FREEONCLOSE: SQLite frees the buffer when the db is closed (otherwise
    // we leak WASM memory every time we swap DBs, e.g. on each import).
    const rc = s.capi.sqlite3_deserialize(
      db.pointer!,
      'main',
      p,
      bytes.byteLength,
      bytes.byteLength,
      s.capi.SQLITE_DESERIALIZE_RESIZEABLE | s.capi.SQLITE_DESERIALIZE_FREEONCLOSE,
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
  // Match the official FitNotes SQLite schema verbatim so an export from
  // this app can be imported back into the Android FitNotes app and vice
  // versa. The DDL here is taken directly from a real FitNotes backup.
  db.exec(`
    CREATE TABLE android_metadata (locale TEXT);
    CREATE TABLE Category(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, colour INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE exercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category_id INTEGER NOT NULL, exercise_type_id INTEGER NOT NULL DEFAULT 0, notes TEXT, weight_increment INTEGER, default_graph_id INTEGER, default_rest_time INTEGER, weight_unit_id INTEGER NOT NULL DEFAULT 0, is_favourite INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE training_log (_id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL, date DATE NOT NULL, metric_weight INTEGER NOT NULL, reps INTEGER NOT NULL, unit INTEGER NOT NULL DEFAULT 0, routine_section_exercise_set_id INTEGER NOT NULL DEFAULT 0, timer_auto_start INTEGER NOT NULL DEFAULT 0, is_personal_record INTEGER NOT NULL DEFAULT 0, is_personal_record_first INTEGER NOT NULL DEFAULT 0, is_complete INTEGER NOT NULL DEFAULT 0, is_pending_update INTEGER NOT NULL DEFAULT 0, distance INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE WorkoutComment (_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, comment TEXT NOT NULL);
    CREATE TABLE BodyWeight (_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, body_weight_metric REAL NOT NULL, body_fat REAL NOT NULL DEFAULT 0, comments TEXT);
    INSERT INTO android_metadata VALUES ('en_US');
  `);
  // Default categories (FitNotes-style signed 32-bit ARGB colours).
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
  const catId: Record<string, number> = {};
  for (const [name, colour, sort] of cats) {
    db.exec({ sql: 'INSERT INTO Category (name, colour, sort_order) VALUES (?, ?, ?)', bind: [name, colour, sort] });
    catId[name] = Number(db.selectValue('SELECT last_insert_rowid()'));
  }

  // Seed ~90 of the most common gym exercises so new users don't start from
  // an empty catalogue. All names normalised to "Nombre (implemento)".
  const seed: Array<[cat: string, name: string]> = [
    // ── Pecho ─────────────────────────────────────────────────────────
    ['Pecho', 'Press Banca Plano (barra)'],
    ['Pecho', 'Press Banca Inclinado (barra)'],
    ['Pecho', 'Press Banca Declinado (barra)'],
    ['Pecho', 'Press Banca Plano (mancuernas)'],
    ['Pecho', 'Press Banca Inclinado (mancuernas)'],
    ['Pecho', 'Press Banca Plano (multipower)'],
    ['Pecho', 'Press Pecho (máquina)'],
    ['Pecho', 'Aperturas (mancuernas)'],
    ['Pecho', 'Cruce Poleas Altas'],
    ['Pecho', 'Cruce Poleas Bajas'],
    ['Pecho', 'Contracción Pecho (máquina)'],
    ['Pecho', 'Pull Over (mancuerna)'],
    ['Pecho', 'Flexiones'],
    ['Pecho', 'Fondos en Paralelas'],
    // ── Espalda ───────────────────────────────────────────────────────
    ['Espalda', 'Dominadas'],
    ['Espalda', 'Dominadas Asistidas (máquina)'],
    ['Espalda', 'Jalón al Pecho (polea)'],
    ['Espalda', 'Jalón al Pecho Agarre Cerrado'],
    ['Espalda', 'Jalón al Pecho Agarre Supino'],
    ['Espalda', 'Remo con Barra'],
    ['Espalda', 'Remo Unilateral (mancuerna)'],
    ['Espalda', 'Remo Sentado (polea)'],
    ['Espalda', 'Remo Seal (mancuernas)'],
    ['Espalda', 'Remo en T'],
    ['Espalda', 'Remo (máquina)'],
    ['Espalda', 'Peso Muerto (barra)'],
    ['Espalda', 'Peso Muerto Rumano (barra)'],
    ['Espalda', 'Hiperextensiones'],
    ['Espalda', 'Encogimientos Trapecio (mancuernas)'],
    ['Espalda', 'Face Pull (polea)'],
    // ── Pierna ────────────────────────────────────────────────────────
    ['Pierna', 'Sentadilla (barra)'],
    ['Pierna', 'Sentadilla Frontal (barra)'],
    ['Pierna', 'Hack Squat (máquina)'],
    ['Pierna', 'Prensa (máquina)'],
    ['Pierna', 'Extensión Cuádriceps (máquina)'],
    ['Pierna', 'Femoral Tumbado (máquina)'],
    ['Pierna', 'Femoral Sentado (máquina)'],
    ['Pierna', 'Peso Muerto Rumano (mancuernas)'],
    ['Pierna', 'Zancadas (mancuernas)'],
    ['Pierna', 'Zancadas Caminando'],
    ['Pierna', 'Sentadilla Búlgara (mancuernas)'],
    ['Pierna', 'Hip Thrust (barra)'],
    ['Pierna', 'Hip Thrust (máquina)'],
    ['Pierna', 'Gemelos de Pie (máquina)'],
    ['Pierna', 'Gemelos Sentado (máquina)'],
    ['Pierna', 'Gemelos en Prensa'],
    ['Pierna', 'Abductores (máquina)'],
    ['Pierna', 'Aductores (máquina)'],
    ['Pierna', 'Patada Glúteo (máquina)'],
    // ── Hombro ────────────────────────────────────────────────────────
    ['Hombro', 'Press Militar (barra)'],
    ['Hombro', 'Press Militar (mancuernas)'],
    ['Hombro', 'Press Militar (multipower)'],
    ['Hombro', 'Press Arnold (mancuernas)'],
    ['Hombro', 'Press Hombro (máquina)'],
    ['Hombro', 'Elevación Lateral (mancuernas)'],
    ['Hombro', 'Elevación Lateral (polea)'],
    ['Hombro', 'Elevación Lateral (máquina)'],
    ['Hombro', 'Elevación Frontal (mancuernas)'],
    ['Hombro', 'Pájaros (mancuernas)'],
    ['Hombro', 'Pájaros (máquina)'],
    // ── Bíceps ────────────────────────────────────────────────────────
    ['Bíceps', 'Curl Bíceps (barra)'],
    ['Bíceps', 'Curl Bíceps (mancuernas)'],
    ['Bíceps', 'Curl Martillo (mancuernas)'],
    ['Bíceps', 'Curl Predicador (barra)'],
    ['Bíceps', 'Curl Predicador (máquina)'],
    ['Bíceps', 'Curl Bíceps (polea)'],
    ['Bíceps', 'Curl Concentrado (mancuerna)'],
    ['Bíceps', 'Curl Araña (barra)'],
    // ── Tríceps ───────────────────────────────────────────────────────
    ['Tríceps', 'Press Francés (barra)'],
    ['Tríceps', 'Press Francés (mancuernas)'],
    ['Tríceps', 'Press Banca Cerrado (barra)'],
    ['Tríceps', 'Tríceps Polea (barra recta)'],
    ['Tríceps', 'Tríceps Polea (cuerda)'],
    ['Tríceps', 'Tríceps Polea Unilateral'],
    ['Tríceps', 'Patada Tríceps (mancuerna)'],
    ['Tríceps', 'Fondos (máquina)'],
    ['Tríceps', 'Fondos en Banco'],
    // ── Core ──────────────────────────────────────────────────────────
    ['Core', 'Plancha'],
    ['Core', 'Plancha Lateral'],
    ['Core', 'Crunch'],
    ['Core', 'Crunch en Polea'],
    ['Core', 'Abdominales (máquina)'],
    ['Core', 'Elevaciones de Piernas'],
    ['Core', 'Rueda Abdominal'],
    ['Core', 'Russian Twist'],
    ['Core', 'Lumbares (máquina)'],
    // ── Antebrazo ─────────────────────────────────────────────────────
    ['Antebrazo', 'Curl Antebrazo (barra)'],
    ['Antebrazo', 'Curl Antebrazo Inverso'],
    ['Antebrazo', 'Curl Antebrazo (mancuerna)'],
    ['Antebrazo', 'Agarre Mancuernas'],
    // ── Cardio ────────────────────────────────────────────────────────
    ['Cardio', 'Cinta'],
    ['Cardio', 'Correr'],
    ['Cardio', 'Caminar'],
    ['Cardio', 'Bici'],
    ['Cardio', 'Bici Estática'],
    ['Cardio', 'Elíptica'],
    ['Cardio', 'Escalera'],
    ['Cardio', 'Remo (cardio)'],
    ['Cardio', 'Natación'],
  ];
  for (const [cat, name] of seed) {
    db.exec({
      sql: 'INSERT INTO exercise (name, category_id) VALUES (?, ?)',
      bind: [name, catId[cat]],
    });
  }
  return db;
}

function serialize(db: Database): Uint8Array {
  const s = sqlite3!;
  const bytes = s.capi.sqlite3_js_db_export(db.pointer!);
  return bytes;
}

// ── Schema migration ──────────────────────────────────────────────────
// FitNotes exports in the wild span several app versions. Older files may
// be missing columns (notably `distance` and `duration_seconds`) or even
// entire tables (`BodyWeight`, `WorkoutComment`). The app's queries assume
// a superset of the schema, so the moment the user imports/loads a stale
// file we top it up. This is safe-idempotent and runs in milliseconds.

function tableExists(db: Database, name: string): boolean {
  const n = Number(db.selectValue(
    'SELECT COUNT(*) FROM sqlite_master WHERE type = ? AND name = ?',
    ['table', name],
  ) ?? 0);
  return n > 0;
}

function columnNames(db: Database, table: string): Set<string> {
  if (!tableExists(db, table)) return new Set();
  const cols = db.exec({
    sql: `PRAGMA table_info(${table})`,
    rowMode: 'object',
    returnValue: 'resultRows',
  }) as Array<{ name: string }>;
  return new Set(cols.map((c) => c.name));
}

function addColumnIfMissing(
  db: Database,
  table: string,
  col: string,
  ddl: string,
  existing: Set<string>,
) {
  if (existing.has(col)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
  existing.add(col);
}

function migrateSchema(db: Database): void {
  // ---- training_log: cardio fields + flags ------------------------------
  if (tableExists(db, 'training_log')) {
    const cols = columnNames(db, 'training_log');
    addColumnIfMissing(db, 'training_log', 'unit',                            'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'training_log', 'routine_section_exercise_set_id', 'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'training_log', 'timer_auto_start',                'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'training_log', 'is_personal_record',              'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'training_log', 'is_personal_record_first',        'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'training_log', 'is_complete',                     'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'training_log', 'is_pending_update',               'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'training_log', 'distance',                        'REAL NOT NULL DEFAULT 0',    cols);
    addColumnIfMissing(db, 'training_log', 'duration_seconds',                'INTEGER NOT NULL DEFAULT 0', cols);
  }

  // ---- exercise: extended metadata -------------------------------------
  if (tableExists(db, 'exercise')) {
    const cols = columnNames(db, 'exercise');
    addColumnIfMissing(db, 'exercise', 'exercise_type_id',  'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'exercise', 'notes',             'TEXT',                       cols);
    addColumnIfMissing(db, 'exercise', 'weight_increment',  'INTEGER',                    cols);
    addColumnIfMissing(db, 'exercise', 'default_graph_id',  'INTEGER',                    cols);
    addColumnIfMissing(db, 'exercise', 'default_rest_time', 'INTEGER',                    cols);
    addColumnIfMissing(db, 'exercise', 'weight_unit_id',    'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'exercise', 'is_favourite',      'INTEGER NOT NULL DEFAULT 0', cols);
  }

  // ---- Category: colour + sort_order -----------------------------------
  if (tableExists(db, 'Category')) {
    const cols = columnNames(db, 'Category');
    addColumnIfMissing(db, 'Category', 'colour',     'INTEGER NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'Category', 'sort_order', 'INTEGER NOT NULL DEFAULT 0', cols);
  }

  // ---- Optional satellite tables ---------------------------------------
  if (!tableExists(db, 'WorkoutComment')) {
    db.exec(`CREATE TABLE WorkoutComment (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      comment TEXT NOT NULL
    )`);
  }
  if (!tableExists(db, 'BodyWeight')) {
    db.exec(`CREATE TABLE BodyWeight (
      _id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      body_weight_metric REAL NOT NULL,
      body_fat REAL NOT NULL DEFAULT 0,
      comments TEXT
    )`);
  } else {
    const cols = columnNames(db, 'BodyWeight');
    addColumnIfMissing(db, 'BodyWeight', 'body_fat', 'REAL NOT NULL DEFAULT 0', cols);
    addColumnIfMissing(db, 'BodyWeight', 'comments', 'TEXT',                    cols);
  }
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

/** Ask the browser for "persistent" storage. On iOS Safari and Chrome
 *  this prevents OPFS / localStorage from being cleared automatically
 *  after a few days of inactivity, which is the most common cause of
 *  "I logged a set yesterday and now it's gone". Best-effort — browsers
 *  may grant or deny without prompting. */
async function requestPersistentStorage(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      const already = await navigator.storage.persisted?.();
      if (!already) await navigator.storage.persist();
    }
  } catch {
    // ignore — purely a nice-to-have
  }
}

export async function loadDatabase(options: { seedUrl?: string } = {}): Promise<void> {
  if (status === 'loading' || status === 'ready') return;
  setStatus('loading');
  try {
    await initSqlite();
    void requestPersistentStorage();

    // 1. Prefer a copy already in OPFS (fastest startup).
    let bytes = await opfsRead();

    // 1b. SELF-HEAL: if a previous session exited with `pending=true`
    //     (we marked the DB dirty but Drive never confirmed the push),
    //     the OPFS copy is the source of truth. Push it BEFORE checking
    //     remote, otherwise the remote-newer check below would happily
    //     overwrite our local changes with whatever Drive last had.
    if (bytes && isPending() && isSignedIn()) {
      try {
        const meta = await pushBlobToDrive(bytes);
        writeStoredMeta({ modifiedTime: meta.modifiedTime, size: meta.size });
        setLastSyncAt(Date.now());
        setPending(false);
        console.log('[sync] self-heal: pushed pending OPFS bytes to Drive');
      } catch (e) {
        console.error('[sync] self-heal push failed; will retry later', e);
        // Keep the pending flag set so the next online/visibility event
        // tries again. Skip the remote-newer check below (we don't want
        // to clobber our unpushed changes with a possibly older Drive
        // copy).
      }
    }

    // 2. If signed in, check Drive. Prefer the remote copy when it is newer
    //    than what we have cached locally — otherwise changes made on another
    //    device (e.g. the phone) would never show up until OPFS is wiped.
    //    Skipped while pending: those bytes are not safe to overwrite yet.
    if (isSignedIn() && !isPending()) {
      const meta = await getRemoteMeta().catch(() => null);
      if (meta) {
        const stored = readStoredMeta();
        const isNewer = !stored || stored.modifiedTime !== meta.modifiedTime || stored.size !== meta.size;
        if (!bytes || isNewer) {
          const remote = await pullBlobFromDrive().catch(() => null);
          if (remote) {
            bytes = new Uint8Array(remote);
            await opfsWrite(bytes);
            writeStoredMeta(meta);
          }
        }
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
    migrateSchema(db);
    setStatus('ready');
  } catch (e) {
    console.error('loadDatabase', e);
    setStatus('error', e);
  }
}

/** Replace the in-memory DB with these bytes (user uploaded a backup).
 *  Runs `migrateSchema` so older FitNotes exports (missing cardio columns,
 *  satellite tables, etc.) are brought up to the shape our queries
 *  expect — and the migrated bytes are what we persist to OPFS/Drive. */
export async function importBytes(bytes: Uint8Array): Promise<void> {
  await initSqlite();

  // Fail fast with a readable message when the bytes are not a SQLite file
  // at all. The sqlite3 magic string is the first 16 bytes.
  const MAGIC = 'SQLite format 3\0';
  const head = new TextDecoder().decode(bytes.slice(0, 16));
  if (head !== MAGIC) {
    throw new Error(
      'El archivo no parece un backup de FitNotes: no es una base de datos SQLite.',
    );
  }

  let newDb: Database;
  try {
    newDb = openFromBytes(bytes);
  } catch (e: any) {
    console.error('[import] sqlite3_deserialize failed', e);
    throw new Error(
      'No se pudo abrir el archivo: ' + (e?.message ?? 'error desconocido al deserializar'),
    );
  }

  // Quick shape check — the three tables the app needs. If none exist,
  // this isn't a FitNotes DB at all (could be somebody else's SQLite file).
  try {
    const core = Number(newDb.selectValue(
      `SELECT COUNT(*) FROM sqlite_master
       WHERE type = 'table' AND name IN ('Category','exercise','training_log')`,
    ) ?? 0);
    if (core < 3) {
      newDb.close();
      throw new Error(
        'El archivo no parece un backup de FitNotes: faltan las tablas Category/exercise/training_log.',
      );
    }
  } catch (e: any) {
    console.error('[import] shape check failed', e);
    throw e instanceof Error ? e : new Error(String(e));
  }

  try {
    newDb.exec('PRAGMA foreign_keys=OFF;'); // don't block ALTERs on existing FK rows
    migrateSchema(newDb);
    newDb.exec('PRAGMA foreign_keys=ON;');
  } catch (e: any) {
    console.error('[import] migrateSchema failed', e);
    newDb.close();
    throw new Error(
      'Error SQL migrando el esquema: ' + (e?.message ?? 'sin detalle'),
    );
  }

  // Only swap once migration succeeded — if something above throws we keep
  // the previous DB intact.
  if (db) { db.close(); db = null; }
  db = newDb;

  // Persist the migrated bytes, not the originals, so future loads don't
  // have to re-migrate.
  try {
    const migratedBytes = serialize(db);
    await opfsWrite(migratedBytes);
  } catch (e: any) {
    console.error('[import] persist failed', e);
    // Don't bail — the in-memory DB is already usable.
  }
  setStatus('ready');
  scheduleSync(true);
}

export function getDb(): Database {
  if (!db) throw new Error('Database not loaded — call loadDatabase() first.');
  return db;
}

// ── sync to Drive ─────────────────────────────────────────────────────
//
// Reliability model:
//   1. Every mutation calls `markDirty()` which immediately kicks off a
//      Drive push (no debounce). Multiple mutations in quick succession
//      coalesce via the in-flight check + a "still dirty after flush"
//      re-fire — so the server is hit at most once per push round-trip,
//      not once per keystroke.
//   2. The "I have unpushed changes" bit is persisted to localStorage so
//      a session that died mid-push (mobile backgrounding, network drop,
//      page close) can self-heal on the next load: before any remote-
//      newer check, we re-push the OPFS bytes to Drive.
//   3. `online` and `visibilitychange → visible` both re-attempt the push
//      if the pending flag is still set, catching cases where the user
//      came back to a previously-failed device.

export type SyncState = 'idle' | 'dirty' | 'syncing' | 'error';
const LS_LAST_SYNC = 'gymlog-last-sync';
const LS_PENDING = 'gymlog-sync-pending';

let dirty = false;
let inFlight: Promise<void> | null = null;
let syncState: SyncState = 'idle';
let lastSyncAt: number | null = (() => {
  try {
    const raw = localStorage.getItem(LS_LAST_SYNC);
    return raw ? Number(raw) : null;
  } catch { return null; }
})();
const syncListeners = new Set<(info: { state: SyncState; lastSyncAt: number | null }) => void>();

function setSyncState(next: SyncState) {
  syncState = next;
  for (const l of syncListeners) l({ state: syncState, lastSyncAt });
}
function setLastSyncAt(ts: number | null) {
  lastSyncAt = ts;
  try {
    if (ts) localStorage.setItem(LS_LAST_SYNC, String(ts));
    else localStorage.removeItem(LS_LAST_SYNC);
  } catch {}
  for (const l of syncListeners) l({ state: syncState, lastSyncAt });
}

function isPending(): boolean {
  try { return localStorage.getItem(LS_PENDING) === '1'; } catch { return false; }
}
function setPending(v: boolean): void {
  try {
    if (v) localStorage.setItem(LS_PENDING, '1');
    else localStorage.removeItem(LS_PENDING);
  } catch {}
}

export function getSyncInfo(): { state: SyncState; lastSyncAt: number | null } {
  return { state: syncState, lastSyncAt };
}

export function onSyncChange(fn: (info: { state: SyncState; lastSyncAt: number | null }) => void): () => void {
  syncListeners.add(fn);
  fn({ state: syncState, lastSyncAt });
  return () => { syncListeners.delete(fn); };
}

export function markDirty() {
  dirty = true;
  // Persist the bit so the next session can self-heal even if the page
  // dies before the upload finishes (mobile lifecycle, iOS Safari, etc).
  setPending(true);
  if (syncState !== 'syncing') setSyncState('dirty');
  // Push immediately. The in-flight + still-dirty re-fire pattern below
  // coalesces bursts so we don't actually upload on every keystroke.
  void flushToDrive().catch(() => {});
}

async function flushToDrive(): Promise<void> {
  if (!db || !dirty) return;
  if (inFlight) return inFlight;
  // NOTE: deliberately *not* bailing on `!isSignedIn()`. The Google access
  // token expires every hour; once it's gone, isSignedIn() returns false
  // and the flush would silently drop the upload, leaving the user stuck
  // on a yellow "cambios sin subir" pill forever. Letting the push run
  // means authHeaders → getAccessToken triggers a silent refresh; if that
  // fails (e.g. third-party cookies blocked on iOS) the error surfaces
  // as the red pill and the user can tap it to re-auth interactively.
  dirty = false;
  setSyncState('syncing');
  inFlight = (async () => {
    try {
      const bytes = serialize(db!);
      await opfsWrite(bytes);
      // pushBlobToDrive returns the new modifiedTime/size so we don't
      // need a separate getRemoteMeta() round-trip — that extra call is
      // what was making the "syncing" pill linger on slow connections.
      const meta = await pushBlobToDrive(bytes);
      writeStoredMeta({ modifiedTime: meta.modifiedTime, size: meta.size });
      setLastSyncAt(Date.now());
      // Only clear the pending bit if no new mutation came in mid-flight.
      if (!dirty) setPending(false);
      setSyncState(dirty ? 'dirty' : 'idle');
    } catch (e) {
      dirty = true;             // keep the dirty bit so we retry later
      setSyncState('error');
      throw e;
    } finally {
      inFlight = null;
    }
  })();
  // After this push lands, if more mutations sneaked in, run another.
  inFlight
    .then(() => {
      if (dirty && !inFlight) {
        // tiny delay so React state updates can batch
        setTimeout(() => { void flushToDrive().catch(() => {}); }, 50);
      }
    })
    .catch(() => {/* error path handles its own retry via online/visibility */});
  return inFlight;
}

/**
 * If the remote copy on Drive is newer than what we have locally, pull it in
 * and hot-swap the in-memory database. Returns true if a swap happened.
 * Safe to call opportunistically (on tab focus, etc). Skips if there are
 * unpushed local edits — those get flushed first by the caller.
 */
async function pullRemoteIfNewer(): Promise<boolean> {
  if (!db || !isSignedIn()) return false;
  if (dirty || inFlight) return false;
  const meta = await getRemoteMeta().catch(() => null);
  if (!meta) return false;
  const stored = readStoredMeta();
  if (stored && stored.modifiedTime === meta.modifiedTime && stored.size === meta.size) return false;
  const buf = await pullBlobFromDrive().catch(() => null);
  if (!buf) return false;
  const bytes = new Uint8Array(buf);
  await opfsWrite(bytes);
  db.close();
  db = openFromBytes(bytes);
  db.exec('PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');
  migrateSchema(db);
  writeStoredMeta(meta);
  window.dispatchEvent(new CustomEvent('gymlog:db-swapped'));
  return true;
}

export async function checkForRemoteUpdates(): Promise<boolean> {
  if (dirty) { try { await flushToDrive(); } catch {} }
  return pullRemoteIfNewer();
}

export async function scheduleSync(immediate = false): Promise<void> {
  dirty = true;
  if (immediate) return flushToDrive();
  markDirty();
}

/** Serialize the current in-memory database. Callers typically trigger a
 *  download of the bytes as a .fitnotes file. */
export function exportBytes(): Uint8Array {
  if (!db) throw new Error('Database not loaded.');
  return serialize(db);
}

/** Force a flush right now (e.g. from a "Sincronizar" button in Settings).
 *  Resolves when the upload completes. */
export async function flushNow(): Promise<void> {
  if (!dirty && !isPending()) return;
  // If pending but dirty=false (app loaded with stale flag from previous
  // session), set dirty so flushToDrive actually runs.
  if (isPending()) dirty = true;
  return flushToDrive();
}

/** User-triggered "sincroniza ya" — pushes pending edits and then pulls
 *  any remote updates from another device. Always does both legs so the
 *  pill click always reconciles, even when nothing is dirty locally. If
 *  the silent token refresh has been failing (iOS Safari, blocked
 *  third-party cookies), this is also our chance to prompt the user
 *  interactively from inside their gesture. */
export async function forceSync(): Promise<void> {
  if (dirty || isPending()) {
    try {
      await flushNow();
    } catch (e) {
      console.error('[forceSync] push failed, trying interactive re-auth', e);
      try {
        await getAccessToken(true); // popup, runs inside the click gesture
        // Re-arm dirty so flushToDrive actually runs and try again.
        if (isPending()) {
          dirty = true;
          await flushToDrive();
        }
      } catch (e2) {
        console.error('[forceSync] interactive re-auth failed', e2);
      }
    }
  }
  try { await pullRemoteIfNewer(); } catch (e) { console.error('[forceSync] pull', e); }
}

if (typeof window !== 'undefined') {
  const drainPending = () => {
    if (!isPending() || inFlight) return;
    dirty = true;
    void flushToDrive().catch(() => {});
  };

  // Page is being torn down — last chance to push. Async fetch may not
  // complete on mobile but we still try, and the pending flag survives in
  // localStorage so the next session self-heals.
  window.addEventListener('pagehide', () => {
    if (dirty || isPending()) {
      void flushToDrive().catch(() => {});
    }
  });

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (dirty) void flushToDrive().catch(() => {});
    } else if (document.visibilityState === 'visible') {
      // Came back from background. First, finish any pending upload from
      // this device. Then check whether another device (the phone, the
      // desktop) pushed something while we were away.
      drainPending();
      checkForRemoteUpdates().catch(() => {});
    }
  });

  // Network came back — drain pending immediately rather than waiting for
  // the next visibility event.
  window.addEventListener('online', drainPending);

  // Background poll: every 2 minutes while foreground, check remote AND
  // try to drain pending in case a previous push silently failed.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    drainPending();
    checkForRemoteUpdates().catch(() => {});
  }, 120_000);
}

/** Destructive — remove the gymlog.fitnotes backup from the user's Drive
 *  AND the local OPFS copy, then close the in-memory DB. The caller is
 *  expected to reload the page so a fresh empty DB is seeded. */
export async function wipeAll(): Promise<void> {
  try { await deleteBlobFromDrive(); } catch (e) { console.error('[wipe] drive', e); throw e; }
  if (db) { db.close(); db = null; }
  await opfsDelete();
  writeStoredMeta(null);
  setLastSyncAt(null);
  setPending(false);
  dirty = false;
  setSyncState('idle');
  setStatus('idle');
}

// ── teardown on sign-out ──────────────────────────────────────────────
export async function resetLocal(): Promise<void> {
  if (db) { db.close(); db = null; }
  await opfsDelete();
  writeStoredMeta(null);
  setLastSyncAt(null);
  setPending(false);
  dirty = false;
  setSyncState('idle');
  setStatus('idle');
}
