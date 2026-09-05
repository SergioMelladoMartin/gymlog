// Operations journal — lives entirely OUTSIDE the SQLite file (localStorage
// only), per spec section 0.1. Every mutation in queries.ts appends a small,
// self-contained entry here. When sqlite.ts detects that Drive holds a
// newer copy than the one we started editing from, it downloads that
// fresh copy and replays this journal on top of it with idempotent SQL,
// instead of blindly overwriting someone else's (or another device's)
// changes.
//
// Replay never depends on queries.ts (PR badges, exercise joins, etc.) --
// each entry carries exactly the raw values needed to redo the write, so
// replayJournal() only touches `training_log` / `exercise` / `WorkoutComment`
// with plain, idempotent-as-possible statements.

import type { Database } from '@sqlite.org/sqlite-wasm';
import { getStoragePrefix } from './auth';

export type JournalOp =
  | 'createSet'
  | 'updateSet'
  | 'deleteSet'
  | 'duplicateSet'
  | 'copySetsFromDate'
  | 'createExercise'
  | 'updateExercise'
  | 'deleteExercise'
  | 'setWorkoutComment';

export interface JournalEntry {
  op: JournalOp;
  table: 'training_log' | 'exercise' | 'WorkoutComment';
  payload: any;
  ts: number;
}

export const MAX_JOURNAL_ENTRIES = 2000;

function lsKey(): string {
  return `gymlog-ops-journal:${getStoragePrefix()}`;
}
function lsOverflowKey(): string {
  return `gymlog-ops-journal-overflow:${getStoragePrefix()}`;
}

function readRaw(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(lsKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(lsKey(), JSON.stringify(entries));
  } catch {
    // localStorage full/unavailable -- nothing more we can do; the journal
    // is a best-effort reconciliation aid, not the source of truth.
  }
}

/** Append one entry to the journal. If this pushes it past the cap, the
 *  whole journal is discarded and `hasJournalOverflowed()` starts
 *  returning true -- the caller should fall back to the "conflict copy"
 *  path instead of attempting a replay it can no longer trust to be
 *  complete. */
export function appendOp(op: JournalOp, table: JournalEntry['table'], payload: any): void {
  const entries = readRaw();
  entries.push({ op, table, payload, ts: Date.now() });
  if (entries.length > MAX_JOURNAL_ENTRIES) {
    writeRaw([]);
    try { localStorage.setItem(lsOverflowKey(), '1'); } catch {}
    return;
  }
  writeRaw(entries);
}

export function readJournal(): JournalEntry[] {
  return readRaw();
}

export function hasJournalOverflowed(): boolean {
  try { return localStorage.getItem(lsOverflowKey()) === '1'; } catch { return false; }
}

/** Call once the journal has been successfully replayed (or its changes
 *  are otherwise confirmed pushed) so the next conflict starts clean. */
export function clearJournal(): void {
  writeRaw([]);
  try { localStorage.removeItem(lsOverflowKey()); } catch {}
}

// -- replay --------------------------------------------------------------

function rowExists(db: Database, table: string, id: number): boolean {
  const n = Number(
    db.selectValue(`SELECT COUNT(*) FROM ${table} WHERE _id = ?`, [id]) ?? 0,
  );
  return n > 0;
}

/** Re-applies every journal entry, in order, against `db` (expected to be
 *  the freshly-downloaded remote copy). Idempotent by design: inserts just
 *  insert (Drive's copy doesn't have our not-yet-pushed rows by
 *  definition), while updates/deletes only touch rows that still exist. */
export function replayJournal(db: Database, entries: JournalEntry[]): void {
  for (const entry of entries) {
    try {
      replayOne(db, entry);
    } catch (e) {
      console.error('[journal] failed to replay entry', entry, e);
      // Keep going -- one bad entry shouldn't sink the whole reconciliation.
    }
  }
}

function replayOne(db: Database, entry: JournalEntry): void {
  const p = entry.payload ?? {};
  switch (entry.op) {
    case 'createSet': {
      db.exec({
        sql: `INSERT INTO training_log (exercise_id, date, metric_weight, reps, unit, distance, duration_seconds)
              VALUES (?, ?, ?, ?, 0, ?, ?)`,
        bind: [p.exercise_id, p.date, p.weight_kg, p.reps, p.distance_m ?? 0, p.duration_seconds ?? 0],
      });
      break;
    }
    case 'updateSet': {
      if (!rowExists(db, 'training_log', p.id)) break;
      const col: Record<string, string> = {
        weight_kg: 'metric_weight',
        reps: 'reps',
        distance_m: 'distance',
        duration_seconds: 'duration_seconds',
      };
      const fields: string[] = [];
      const params: any[] = [];
      for (const [k, v] of Object.entries(p.patch ?? {})) {
        if (col[k] && v != null) { fields.push(`${col[k]} = ?`); params.push(v); }
      }
      if (!fields.length) break;
      params.push(p.id);
      db.exec({ sql: `UPDATE training_log SET ${fields.join(', ')} WHERE _id = ?`, bind: params });
      break;
    }
    case 'deleteSet': {
      db.exec({ sql: 'DELETE FROM training_log WHERE _id = ?', bind: [p.id] });
      break;
    }
    case 'duplicateSet': {
      // Payload carries the resolved row (captured at op time), not just
      // the source id -- the source row may not exist in the remote copy.
      db.exec({
        sql: `INSERT INTO training_log (exercise_id, date, metric_weight, reps, unit, distance, duration_seconds)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        bind: [p.exercise_id, p.date, p.metric_weight, p.reps, p.unit ?? 0, p.distance ?? 0, p.duration_seconds ?? 0],
      });
      break;
    }
    case 'copySetsFromDate': {
      const toDate = p.toDate;
      for (const r of p.rows ?? []) {
        db.exec({
          sql: `INSERT INTO training_log (exercise_id, date, metric_weight, reps, unit, distance, duration_seconds)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          bind: [r.exercise_id, toDate, r.metric_weight, r.reps, r.unit ?? 0, r.distance ?? 0, r.duration_seconds ?? 0],
        });
      }
      break;
    }
    case 'createExercise': {
      db.exec({
        sql: `INSERT INTO exercise (name, category_id, exercise_type_id, weight_unit_id, is_favourite)
              VALUES (?, ?, 0, 0, 0)`,
        bind: [p.name, p.category_id],
      });
      break;
    }
    case 'updateExercise': {
      if (!rowExists(db, 'exercise', p.id)) break;
      const fields: string[] = [];
      const params: any[] = [];
      if (p.patch?.name != null) { fields.push('name = ?'); params.push(p.patch.name); }
      if (p.patch?.category_id != null) { fields.push('category_id = ?'); params.push(p.patch.category_id); }
      if (!fields.length) break;
      params.push(p.id);
      db.exec({ sql: `UPDATE exercise SET ${fields.join(', ')} WHERE _id = ?`, bind: params });
      break;
    }
    case 'deleteExercise': {
      db.exec({ sql: 'DELETE FROM training_log WHERE exercise_id = ?', bind: [p.id] });
      db.exec({ sql: 'DELETE FROM exercise WHERE _id = ?', bind: [p.id] });
      break;
    }
    case 'setWorkoutComment': {
      if (!p.body || !String(p.body).trim()) {
        db.exec({ sql: 'DELETE FROM WorkoutComment WHERE date = ?', bind: [p.date] });
        break;
      }
      const existing = db.exec({
        sql: 'SELECT _id FROM WorkoutComment WHERE date = ? LIMIT 1',
        bind: [p.date],
        rowMode: 'object',
        returnValue: 'resultRows',
      }) as Array<{ _id: number }>;
      if (existing[0]) {
        db.exec({ sql: 'UPDATE WorkoutComment SET comment = ? WHERE _id = ?', bind: [p.body, existing[0]._id] });
      } else {
        db.exec({ sql: 'INSERT INTO WorkoutComment (date, comment) VALUES (?, ?)', bind: [p.date, p.body] });
      }
      break;
    }
  }
}
