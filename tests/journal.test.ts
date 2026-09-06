// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import sqlite3InitModule, { type Sqlite3Static, type Database } from '@sqlite.org/sqlite-wasm';
import {
  MAX_JOURNAL_ENTRIES,
  appendOp,
  clearJournal,
  hasJournalOverflowed,
  readJournal,
  replayJournal,
} from '../src/lib/journal';

let sqlite3: Sqlite3Static;

function freshDb(): Database {
  const db = new sqlite3.oo1.DB();
  db.exec(`
    CREATE TABLE exercise(_id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category_id INTEGER NOT NULL, exercise_type_id INTEGER NOT NULL DEFAULT 0, weight_unit_id INTEGER NOT NULL DEFAULT 0, is_favourite INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE training_log(_id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL, date DATE NOT NULL, metric_weight INTEGER NOT NULL, reps INTEGER NOT NULL, unit INTEGER NOT NULL DEFAULT 0, distance INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE WorkoutComment(_id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, comment TEXT NOT NULL);
    INSERT INTO exercise (name, category_id) VALUES ('Press Banca', 1);
  `);
  return db;
}

beforeEach(async () => {
  sqlite3 = await sqlite3InitModule({ print: () => {}, printErr: () => {} });
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('journal storage', () => {
  it('starts empty', () => {
    expect(readJournal()).toEqual([]);
    expect(hasJournalOverflowed()).toBe(false);
  });

  it('appends entries in order', () => {
    appendOp('createSet', 'training_log', { exercise_id: 1, date: '2026-01-01', weight_kg: 80, reps: 8 });
    appendOp('deleteSet', 'training_log', { id: 5 });
    const entries = readJournal();
    expect(entries).toHaveLength(2);
    expect(entries[0].op).toBe('createSet');
    expect(entries[1].op).toBe('deleteSet');
  });

  it('clearJournal empties the journal and the overflow flag', () => {
    appendOp('createSet', 'training_log', { exercise_id: 1, date: '2026-01-01', weight_kg: 80, reps: 8 });
    clearJournal();
    expect(readJournal()).toEqual([]);
    expect(hasJournalOverflowed()).toBe(false);
  });

  it('discards the journal and flags overflow past the cap', () => {
    for (let i = 0; i < MAX_JOURNAL_ENTRIES + 1; i++) {
      appendOp('deleteSet', 'training_log', { id: i });
    }
    expect(readJournal()).toEqual([]);
    expect(hasJournalOverflowed()).toBe(true);
    // A fresh successful sync clears the overflow flag again.
    clearJournal();
    expect(hasJournalOverflowed()).toBe(false);
  });
});

describe('replayJournal', () => {
  it('re-applies a createSet entry idempotently against a fresh db', () => {
    const db = freshDb();
    replayJournal(db, [
      { op: 'createSet', table: 'training_log', ts: 1, payload: { exercise_id: 1, date: '2026-01-01', weight_kg: 80, reps: 8 } },
    ]);
    const count = Number(db.selectValue('SELECT COUNT(*) FROM training_log'));
    expect(count).toBe(1);
    const weight = Number(db.selectValue('SELECT metric_weight FROM training_log LIMIT 1'));
    expect(weight).toBe(80);
  });

  it('applies updateSet only when the target row exists', () => {
    const db = freshDb();
    db.exec({ sql: 'INSERT INTO training_log (exercise_id, date, metric_weight, reps) VALUES (1, ?, 70, 5)', bind: ['2026-01-01'] });
    const id = Number(db.selectValue('SELECT last_insert_rowid()'));

    replayJournal(db, [
      { op: 'updateSet', table: 'training_log', ts: 1, payload: { id, patch: { weight_kg: 90 } } },
      { op: 'updateSet', table: 'training_log', ts: 2, payload: { id: id + 999, patch: { weight_kg: 999 } } },
    ]);

    const weight = Number(db.selectValue('SELECT metric_weight FROM training_log WHERE _id = ?', [id]));
    expect(weight).toBe(90);
    // The bogus id must not have inserted or errored anything.
    const count = Number(db.selectValue('SELECT COUNT(*) FROM training_log'));
    expect(count).toBe(1);
  });

  it('deleteSet is a no-op when the row is already gone', () => {
    const db = freshDb();
    replayJournal(db, [{ op: 'deleteSet', table: 'training_log', ts: 1, payload: { id: 12345 } }]);
    const count = Number(db.selectValue('SELECT COUNT(*) FROM training_log'));
    expect(count).toBe(0);
  });

  it('replays a full sequence of ops in order', () => {
    const db = freshDb();
    replayJournal(db, [
      { op: 'createSet', table: 'training_log', ts: 1, payload: { exercise_id: 1, date: '2026-01-01', weight_kg: 80, reps: 8 } },
      { op: 'setWorkoutComment', table: 'WorkoutComment', ts: 2, payload: { date: '2026-01-01', body: 'buen día' } },
    ]);
    const setCount = Number(db.selectValue('SELECT COUNT(*) FROM training_log'));
    expect(setCount).toBe(1);
    const comment = db.selectValue('SELECT comment FROM WorkoutComment WHERE date = ?', ['2026-01-01']);
    expect(comment).toBe('buen día');
  });
});
