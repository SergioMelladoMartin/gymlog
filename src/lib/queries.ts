// Query layer against the raw FitNotes SQLite schema (no renaming, no
// transforms). Runs fully in-browser via sqlite-wasm. Mutations mark the
// database dirty so the store will flush to Google Drive on a debounce.

import { getDb, markDirty } from './sqlite';
import type {
  BodyWeight,
  Category,
  Exercise,
  PrFlags,
  TrainingSet,
} from './types';

function rows<T = any>(sql: string, params: any[] = []): T[] {
  const db = getDb();
  return db.exec({ sql, bind: params, rowMode: 'object', returnValue: 'resultRows' }) as T[];
}

function exec(sql: string, params: any[] = []): void {
  const db = getDb();
  db.exec({ sql, bind: params });
}

// ─── Categories ───────────────────────────────────────────────────────

function argbToHex(n: number | null): string | null {
  if (n == null) return null;
  const u = n >>> 0;
  return '#' + [(u >> 16) & 0xff, (u >> 8) & 0xff, u & 0xff]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
}

export function getCategories(): Category[] {
  return rows<{ _id: number; name: string; colour: number | null; sort_order: number }>(
    'SELECT _id, name, colour, sort_order FROM Category ORDER BY sort_order, name',
  ).map((r) => ({
    id: r._id,
    name: r.name,
    color: argbToHex(r.colour),
    sort_order: r.sort_order,
  }));
}

// ─── Exercises ────────────────────────────────────────────────────────

export interface ExerciseExtra extends Exercise {
  category_name: string;
  category_color: string | null;
  last_used: string | null;
}

export function getExercises(): ExerciseExtra[] {
  return rows<any>(
    `SELECT e._id AS id, e.name, e.category_id, c.name AS category_name, c.colour AS category_colour,
            e.notes, e.is_favourite,
            (SELECT MAX(date) FROM training_log WHERE exercise_id = e._id) AS last_used
     FROM exercise e
     JOIN Category c ON c._id = e.category_id
     ORDER BY c.sort_order, e.name`,
  ).map((r) => ({
    id: r.id,
    name: r.name,
    category_id: r.category_id,
    category_name: r.category_name,
    category_color: argbToHex(r.category_colour),
    notes: r.notes ?? null,
    is_favorite: !!r.is_favourite,
    last_used: r.last_used ?? null,
  }));
}

export function getExerciseById(id: number): ExerciseExtra | null {
  const r = rows<any>(
    `SELECT e._id AS id, e.name, e.category_id, c.name AS category_name, c.colour AS category_colour,
            e.notes, e.is_favourite
     FROM exercise e
     JOIN Category c ON c._id = e.category_id
     WHERE e._id = ?`,
    [id],
  )[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    category_id: r.category_id,
    category_name: r.category_name,
    category_color: argbToHex(r.category_colour),
    notes: r.notes ?? null,
    is_favorite: !!r.is_favourite,
    last_used: null,
  };
}

export function createExercise(name: string, categoryId: number): number {
  const db = getDb();
  db.exec({
    sql: `INSERT INTO exercise (name, category_id, exercise_type_id, weight_unit_id, is_favourite)
          VALUES (?, ?, 0, 0, 0)`,
    bind: [name, categoryId],
  });
  const id = Number(db.selectValue('SELECT last_insert_rowid()'));
  markDirty();
  return id;
}

export function countExerciseSets(id: number): number {
  const row = getDb().exec({
    sql: 'SELECT COUNT(*) AS n FROM training_log WHERE exercise_id = ?',
    bind: [id],
    rowMode: 'object',
    returnValue: 'resultRows',
  })[0] as any;
  return Number(row?.n ?? 0);
}

export function deleteExercise(id: number): void {
  exec('DELETE FROM training_log WHERE exercise_id = ?', [id]);
  exec('DELETE FROM exercise WHERE _id = ?', [id]);
  markDirty();
}

export function updateExercise(id: number, patch: { name?: string; category_id?: number }): void {
  const fields: string[] = [];
  const params: any[] = [];
  if (patch.name != null) { fields.push('name = ?'); params.push(patch.name); }
  if (patch.category_id != null) { fields.push('category_id = ?'); params.push(patch.category_id); }
  if (!fields.length) return;
  params.push(id);
  exec(`UPDATE exercise SET ${fields.join(', ')} WHERE _id = ?`, params);
  markDirty();
}

// ─── PR detection (current holders) ───────────────────────────────────
// Shared sub-query producing the single set id that holds each PR type
// for every exercise. Ties resolved by earliest _id.
const PR_HOLDERS_CTE = `
  WITH pr_holders AS (
    SELECT e._id AS exercise_id,
      (SELECT _id FROM training_log
       WHERE exercise_id = e._id
       ORDER BY metric_weight DESC, _id ASC LIMIT 1) AS pr_w_id,
      (SELECT _id FROM training_log
       WHERE exercise_id = e._id
       ORDER BY (metric_weight * (1.0 + reps / 30.0)) DESC, _id ASC LIMIT 1) AS pr_1rm_id
    FROM exercise e
  ),
  pr_reps_holders AS (
    SELECT _id, exercise_id
    FROM (
      SELECT _id, exercise_id, metric_weight, reps,
             ROW_NUMBER() OVER (PARTITION BY exercise_id, metric_weight ORDER BY reps DESC, _id ASC) AS rn
      FROM training_log
    ) t WHERE rn = 1
  )
`;

// ─── Sets (training_log) ──────────────────────────────────────────────

export interface TrainingSetEx extends TrainingSet {
  exercise_name: string;
  category_id: number;
  category_color: string | null;
}

export function getSetsForDate(date: string): (TrainingSetEx & PrFlags)[] {
  return rows<any>(
    `${PR_HOLDERS_CTE}
     SELECT ts._id AS id, ts.exercise_id, e.name AS exercise_name,
            e.category_id, c.colour AS category_colour,
            ts.date, ts.metric_weight AS weight_kg, ts.reps,
            ts.distance AS distance_m, ts.duration_seconds,
            CASE WHEN ts._id = ph.pr_w_id    THEN 1 ELSE 0 END AS pr_weight,
            CASE WHEN ts._id = ph.pr_1rm_id  THEN 1 ELSE 0 END AS pr_1rm,
            CASE WHEN prh._id IS NOT NULL    THEN 1 ELSE 0 END AS pr_reps
     FROM training_log ts
     JOIN exercise e ON e._id = ts.exercise_id
     JOIN Category c ON c._id = e.category_id
     JOIN pr_holders ph ON ph.exercise_id = ts.exercise_id
     LEFT JOIN pr_reps_holders prh ON prh._id = ts._id
     WHERE ts.date = ?
     ORDER BY ts._id ASC`,
    [date],
  ).map((r) => ({
    id: r.id,
    exercise_id: r.exercise_id,
    exercise_name: r.exercise_name,
    category_id: r.category_id,
    category_color: argbToHex(r.category_colour),
    date: r.date,
    weight_kg: Number(r.weight_kg),
    reps: Number(r.reps),
    distance_m: Number(r.distance_m),
    duration_seconds: Number(r.duration_seconds),
    position: 0,
    created_at: null,
    pr_weight: !!r.pr_weight,
    pr_1rm: !!r.pr_1rm,
    pr_reps: !!r.pr_reps,
  }));
}

export function createSet(payload: {
  exercise_id: number;
  date: string;
  weight_kg: number;
  reps: number;
  distance_m?: number;
  duration_seconds?: number;
}): { id: number; pr_weight: boolean; pr_1rm: boolean; pr_reps: boolean } {
  const db = getDb();
  db.exec({
    sql: `INSERT INTO training_log (exercise_id, date, metric_weight, reps, unit, distance, duration_seconds)
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    bind: [
      payload.exercise_id,
      payload.date,
      payload.weight_kg,
      payload.reps,
      payload.distance_m ?? 0,
      payload.duration_seconds ?? 0,
    ],
  });
  const id = Number(db.selectValue('SELECT last_insert_rowid()'));

  // PR detection for the just-inserted set.
  const hw = Number(
    db.selectValue(
      'SELECT COALESCE(MAX(metric_weight), 0) FROM training_log WHERE exercise_id = ? AND _id != ?',
      [payload.exercise_id, id],
    ),
  );
  const h1rm = Number(
    db.selectValue(
      `SELECT COALESCE(MAX(metric_weight * (1.0 + reps / 30.0)), 0)
       FROM training_log WHERE exercise_id = ? AND _id != ?`,
      [payload.exercise_id, id],
    ),
  );
  const hReps = Number(
    db.selectValue(
      `SELECT COALESCE(MAX(reps), 0)
       FROM training_log WHERE exercise_id = ? AND metric_weight = ? AND _id != ?`,
      [payload.exercise_id, payload.weight_kg, id],
    ),
  );
  const est1rm = payload.weight_kg * (1 + payload.reps / 30);
  const pr = {
    pr_weight: payload.weight_kg > hw,
    pr_1rm: est1rm > h1rm,
    pr_reps: payload.reps > hReps,
  };

  markDirty();
  return { id, ...pr };
}

export function updateSet(
  id: number,
  patch: Partial<Pick<TrainingSet, 'weight_kg' | 'reps' | 'distance_m' | 'duration_seconds'>>,
): void {
  const col: Record<string, string> = {
    weight_kg: 'metric_weight',
    reps: 'reps',
    distance_m: 'distance',
    duration_seconds: 'duration_seconds',
  };
  const fields: string[] = [];
  const params: any[] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (col[k] && v != null) { fields.push(`${col[k]} = ?`); params.push(v); }
  }
  if (!fields.length) return;
  params.push(id);
  exec(`UPDATE training_log SET ${fields.join(', ')} WHERE _id = ?`, params);
  markDirty();
}

export function deleteSet(id: number): void {
  exec('DELETE FROM training_log WHERE _id = ?', [id]);
  markDirty();
}

// ─── Training days (calendar / diary) ─────────────────────────────────

export interface TrainingDay {
  date: string;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  categories: string | null;
}

export function getTrainingDaysInRange(from: string, to: string): TrainingDay[] {
  return rows<any>(
    `SELECT ts.date,
            COUNT(DISTINCT ts.exercise_id) AS exercise_count,
            COUNT(*)                        AS set_count,
            COALESCE(SUM(ts.metric_weight * ts.reps), 0) AS total_volume,
            GROUP_CONCAT(DISTINCT c.colour) AS categories
     FROM training_log ts
     JOIN exercise e ON e._id = ts.exercise_id
     JOIN Category c ON c._id = e.category_id
     WHERE ts.date BETWEEN ? AND ?
     GROUP BY ts.date
     ORDER BY ts.date ASC`,
    [from, to],
  ).map((r) => ({
    date: r.date,
    exercise_count: Number(r.exercise_count),
    set_count: Number(r.set_count),
    total_volume: Number(r.total_volume),
    categories: r.categories
      ? r.categories
          .split(',')
          .map((n: string) => argbToHex(Number(n)))
          .filter(Boolean)
          .join(',')
      : null,
  }));
}

export interface DayPrCounts { pr_weight: number; pr_1rm: number; pr_reps: number }

export function getDayPrCounts(dates: string[]): Map<string, DayPrCounts> {
  const map = new Map<string, DayPrCounts>();
  if (!dates.length) return map;
  const placeholders = dates.map(() => '?').join(',');
  const res = rows<any>(
    `${PR_HOLDERS_CTE}
     SELECT ts.date,
            SUM(CASE WHEN ts._id = ph.pr_w_id   THEN 1 ELSE 0 END) AS pr_weight,
            SUM(CASE WHEN ts._id = ph.pr_1rm_id THEN 1 ELSE 0 END) AS pr_1rm,
            SUM(CASE WHEN prh._id IS NOT NULL   THEN 1 ELSE 0 END) AS pr_reps
     FROM training_log ts
     JOIN pr_holders ph ON ph.exercise_id = ts.exercise_id
     LEFT JOIN pr_reps_holders prh ON prh._id = ts._id
     WHERE ts.date IN (${placeholders})
     GROUP BY ts.date`,
    dates,
  );
  for (const r of res) {
    map.set(r.date, {
      pr_weight: Number(r.pr_weight) || 0,
      pr_1rm: Number(r.pr_1rm) || 0,
      pr_reps: Number(r.pr_reps) || 0,
    });
  }
  return map;
}

// ─── Per-exercise stats ───────────────────────────────────────────────

export interface ExerciseSessionStat {
  date: string;
  top_weight: number;
  est_1rm: number;
  total_volume: number;
  set_count: number;
  top_set_weight: number;
  top_set_reps: number;
  rm_set_weight: number;
  rm_set_reps: number;
}

export function getExerciseSessionStats(exerciseId: number): ExerciseSessionStat[] {
  return rows<any>(
    `WITH d AS (
       SELECT _id, date, metric_weight AS weight_kg, reps,
              metric_weight * (1.0 + reps / 30.0) AS est,
              metric_weight * reps                AS vol
       FROM training_log WHERE exercise_id = ?
     ),
     top_by_weight AS (
       SELECT date, weight_kg, reps
       FROM (SELECT date, weight_kg, reps,
                    ROW_NUMBER() OVER (PARTITION BY date ORDER BY weight_kg DESC, reps DESC, _id ASC) AS rn
             FROM d) t WHERE rn = 1
     ),
     top_by_1rm AS (
       SELECT date, weight_kg, reps
       FROM (SELECT date, weight_kg, reps,
                    ROW_NUMBER() OVER (PARTITION BY date ORDER BY est DESC, _id ASC) AS rn
             FROM d) t WHERE rn = 1
     ),
     agg AS (
       SELECT date, MAX(weight_kg) AS top_weight, MAX(est) AS est_1rm,
              SUM(vol) AS total_volume, COUNT(*) AS set_count
       FROM d GROUP BY date
     )
     SELECT a.date, a.top_weight, a.est_1rm, a.total_volume, a.set_count,
            tw.weight_kg AS top_set_weight, tw.reps AS top_set_reps,
            tr.weight_kg AS rm_set_weight, tr.reps AS rm_set_reps
     FROM agg a
     JOIN top_by_weight tw ON tw.date = a.date
     JOIN top_by_1rm    tr ON tr.date = a.date
     ORDER BY a.date ASC`,
    [exerciseId],
  ).map((r) => ({
    date: r.date,
    top_weight: Number(r.top_weight),
    est_1rm: Number(r.est_1rm),
    total_volume: Number(r.total_volume),
    set_count: Number(r.set_count),
    top_set_weight: Number(r.top_set_weight),
    top_set_reps: Number(r.top_set_reps),
    rm_set_weight: Number(r.rm_set_weight),
    rm_set_reps: Number(r.rm_set_reps),
  }));
}

export function getExerciseSetsHistory(exerciseId: number, limit = 200): TrainingSetEx[] {
  return rows<any>(
    `SELECT ts._id AS id, ts.exercise_id, e.name AS exercise_name,
            e.category_id, c.colour AS category_colour,
            ts.date, ts.metric_weight AS weight_kg, ts.reps,
            ts.distance AS distance_m, ts.duration_seconds
     FROM training_log ts
     JOIN exercise e ON e._id = ts.exercise_id
     JOIN Category c ON c._id = e.category_id
     WHERE ts.exercise_id = ?
     ORDER BY ts.date DESC, ts._id DESC
     LIMIT ?`,
    [exerciseId, limit],
  ).map((r) => ({
    id: r.id,
    exercise_id: r.exercise_id,
    exercise_name: r.exercise_name,
    category_id: r.category_id,
    category_color: argbToHex(r.category_colour),
    date: r.date,
    weight_kg: Number(r.weight_kg),
    reps: Number(r.reps),
    distance_m: Number(r.distance_m),
    duration_seconds: Number(r.duration_seconds),
    position: 0,
    created_at: null,
  }));
}

// ─── Workout comments ─────────────────────────────────────────────────

export function getWorkoutComment(date: string): string | null {
  const row = rows<{ comment: string }>(
    'SELECT comment FROM WorkoutComment WHERE date = ? LIMIT 1',
    [date],
  )[0];
  return row?.comment ?? null;
}

export function setWorkoutComment(date: string, body: string): void {
  if (!body.trim()) {
    exec('DELETE FROM WorkoutComment WHERE date = ?', [date]);
  } else {
    const existing = rows<{ _id: number }>(
      'SELECT _id FROM WorkoutComment WHERE date = ? LIMIT 1',
      [date],
    )[0];
    if (existing) {
      exec('UPDATE WorkoutComment SET comment = ? WHERE _id = ?', [body, existing._id]);
    } else {
      exec('INSERT INTO WorkoutComment (date, comment) VALUES (?, ?)', [date, body]);
    }
  }
  markDirty();
}

// ─── Body weight ──────────────────────────────────────────────────────

export function getBodyWeight(): BodyWeight[] {
  return rows<any>(
    'SELECT date, body_weight_metric AS weight_kg FROM BodyWeight ORDER BY date DESC',
  );
}

// ─── Utilities ────────────────────────────────────────────────────────

export function todayISO(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}
