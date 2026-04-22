import { db } from './db';

export interface Category {
  id: number;
  name: string;
  color: string | null;
  sort_order: number;
}

export interface Exercise {
  id: number;
  name: string;
  category_id: number;
  category_name: string;
  category_color: string | null;
  is_favorite: number;
  last_used: string | null;
}

export interface TrainingSet {
  id: number;
  exercise_id: number;
  exercise_name: string;
  category_id: number;
  category_color: string | null;
  date: string;
  weight_kg: number;
  reps: number;
  distance_m: number;
  duration_seconds: number;
  is_personal_record: number;
  position: number;
  pr_weight?: number;
  pr_1rm?: number;
  pr_reps?: number;
}

export interface DayPrCounts {
  pr_weight: number;
  pr_1rm: number;
  pr_reps: number;
}

// ── Cache layer ──────────────────────────────────────────────────────────
// Module-level memo. On warm lambdas this cuts roundtrips to Turso to near-zero
// for reads of data that rarely changes (categories, exercise catalogue).
// Invalidation happens on writes that affect the cached shape.

const CATEGORY_TTL_MS = 10 * 60_000;
const EXERCISES_TTL_MS = 60_000;

let categoriesCache: { data: Category[]; expires: number } | null = null;
const exercisesCache = new Map<string, { data: Exercise[]; expires: number }>();

export function invalidateExercisesCache(userId: string) {
  exercisesCache.delete(userId);
}

// Categories are global (shared by every user).
export async function getCategories(): Promise<Category[]> {
  const now = Date.now();
  if (categoriesCache && categoriesCache.expires > now) return categoriesCache.data;
  const res = await db.execute('SELECT id, name, color, sort_order FROM category ORDER BY sort_order, name');
  const data = res.rows as unknown as Category[];
  categoriesCache = { data, expires: now + CATEGORY_TTL_MS };
  return data;
}

export async function getExercises(userId: string): Promise<Exercise[]> {
  const now = Date.now();
  const cached = exercisesCache.get(userId);
  if (cached && cached.expires > now) return cached.data;
  const res = await db.execute({
    sql: `
      SELECT e.id, e.name, e.category_id, c.name AS category_name, c.color AS category_color,
             e.is_favorite,
             (SELECT MAX(date) FROM training_set WHERE exercise_id = e.id AND user_id = ?) AS last_used
      FROM exercise e
      JOIN category c ON c.id = e.category_id
      WHERE e.user_id = ?
      ORDER BY c.sort_order, e.name
    `,
    args: [userId, userId],
  });
  const data = res.rows as unknown as Exercise[];
  exercisesCache.set(userId, { data, expires: now + EXERCISES_TTL_MS });
  return data;
}

/**
 * Shared CTEs resolving the current holder of each PR category *within a user's data*.
 */
const prHoldersCte = (userId: string) => `
  WITH pr_holders AS (
    SELECT e.id AS exercise_id,
      (SELECT id FROM training_set
       WHERE exercise_id = e.id AND user_id = '${userId}'
       ORDER BY weight_kg DESC, id ASC LIMIT 1) AS pr_w_id,
      (SELECT id FROM training_set
       WHERE exercise_id = e.id AND user_id = '${userId}'
       ORDER BY (weight_kg * (1.0 + reps / 30.0)) DESC, id ASC LIMIT 1) AS pr_1rm_id
    FROM exercise e WHERE e.user_id = '${userId}'
  ),
  pr_reps_holders AS (
    SELECT id, exercise_id
    FROM (
      SELECT id, exercise_id, weight_kg, reps,
             ROW_NUMBER() OVER (PARTITION BY exercise_id, weight_kg ORDER BY reps DESC, id ASC) AS rn
      FROM training_set WHERE user_id = '${userId}'
    ) t
    WHERE rn = 1
  )
`;

// Quick sanity check to avoid injection via userId. User ids are ULID/UUID-like.
function assertSafeUserId(userId: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error('invalid user id');
}

export async function getSetsForDate(userId: string, date: string): Promise<TrainingSet[]> {
  assertSafeUserId(userId);
  const res = await db.execute({
    sql: `
      ${prHoldersCte(userId)}
      SELECT ts.id, ts.exercise_id, e.name AS exercise_name,
             e.category_id, c.color AS category_color,
             ts.date, ts.weight_kg, ts.reps, ts.distance_m, ts.duration_seconds,
             ts.is_personal_record, ts.position,
             CASE WHEN ts.id = ph.pr_w_id    THEN 1 ELSE 0 END AS pr_weight,
             CASE WHEN ts.id = ph.pr_1rm_id  THEN 1 ELSE 0 END AS pr_1rm,
             CASE WHEN prh.id IS NOT NULL    THEN 1 ELSE 0 END AS pr_reps
      FROM training_set ts
      JOIN exercise e ON e.id = ts.exercise_id
      JOIN category c ON c.id = e.category_id
      JOIN pr_holders ph ON ph.exercise_id = ts.exercise_id
      LEFT JOIN pr_reps_holders prh ON prh.id = ts.id
      WHERE ts.date = ? AND ts.user_id = ?
      ORDER BY ts.id ASC
    `,
    args: [date, userId],
  });
  return res.rows as unknown as TrainingSet[];
}

export async function getDayPrCounts(userId: string, dates: string[]): Promise<Map<string, DayPrCounts>> {
  assertSafeUserId(userId);
  const map = new Map<string, DayPrCounts>();
  if (!dates.length) return map;
  const placeholders = dates.map(() => '?').join(',');
  const res = await db.execute({
    sql: `
      ${prHoldersCte(userId)}
      SELECT ts.date,
             SUM(CASE WHEN ts.id = ph.pr_w_id   THEN 1 ELSE 0 END) AS pr_weight,
             SUM(CASE WHEN ts.id = ph.pr_1rm_id THEN 1 ELSE 0 END) AS pr_1rm,
             SUM(CASE WHEN prh.id IS NOT NULL   THEN 1 ELSE 0 END) AS pr_reps
      FROM training_set ts
      JOIN pr_holders ph ON ph.exercise_id = ts.exercise_id
      LEFT JOIN pr_reps_holders prh ON prh.id = ts.id
      WHERE ts.date IN (${placeholders}) AND ts.user_id = ?
      GROUP BY ts.date
    `,
    args: [...dates, userId],
  });
  for (const row of res.rows) {
    map.set(row.date as string, {
      pr_weight: Number(row.pr_weight) || 0,
      pr_1rm: Number(row.pr_1rm) || 0,
      pr_reps: Number(row.pr_reps) || 0,
    });
  }
  return map;
}

export interface TrainingDay {
  date: string;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  categories: string; // comma separated colors
}

export async function getTrainingDaysInRange(userId: string, from: string, to: string): Promise<TrainingDay[]> {
  const res = await db.execute({
    sql: `
      SELECT ts.date,
             COUNT(DISTINCT ts.exercise_id) AS exercise_count,
             COUNT(*)                        AS set_count,
             COALESCE(SUM(ts.weight_kg * ts.reps), 0) AS total_volume,
             GROUP_CONCAT(DISTINCT c.color)  AS categories
      FROM training_set ts
      JOIN exercise e ON e.id = ts.exercise_id
      JOIN category c ON c.id = e.category_id
      WHERE ts.user_id = ? AND ts.date BETWEEN ? AND ?
      GROUP BY ts.date
      ORDER BY ts.date ASC
    `,
    args: [userId, from, to],
  });
  return res.rows as unknown as TrainingDay[];
}

export async function getExerciseById(userId: string, id: number): Promise<Exercise | null> {
  const res = await db.execute({
    sql: `
      SELECT e.id, e.name, e.category_id, c.name AS category_name, c.color AS category_color,
             e.is_favorite, NULL AS last_used
      FROM exercise e
      JOIN category c ON c.id = e.category_id
      WHERE e.id = ? AND e.user_id = ?
    `,
    args: [id, userId],
  });
  return (res.rows[0] as unknown as Exercise) ?? null;
}

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

export async function getExerciseSessionStats(userId: string, exerciseId: number): Promise<ExerciseSessionStat[]> {
  const res = await db.execute({
    sql: `
      WITH d AS (
        SELECT id, date, weight_kg, reps,
               weight_kg * (1.0 + reps / 30.0) AS est,
               weight_kg * reps                AS vol
        FROM training_set
        WHERE exercise_id = ? AND user_id = ?
      ),
      top_by_weight AS (
        SELECT date, weight_kg, reps
        FROM (SELECT date, weight_kg, reps,
                     ROW_NUMBER() OVER (PARTITION BY date ORDER BY weight_kg DESC, reps DESC, id ASC) AS rn
              FROM d) t WHERE rn = 1
      ),
      top_by_1rm AS (
        SELECT date, weight_kg, reps
        FROM (SELECT date, weight_kg, reps,
                     ROW_NUMBER() OVER (PARTITION BY date ORDER BY est DESC, id ASC) AS rn
              FROM d) t WHERE rn = 1
      ),
      agg AS (
        SELECT date,
               MAX(weight_kg) AS top_weight,
               MAX(est)       AS est_1rm,
               SUM(vol)       AS total_volume,
               COUNT(*)       AS set_count
        FROM d
        GROUP BY date
      )
      SELECT a.date, a.top_weight, a.est_1rm, a.total_volume, a.set_count,
             tw.weight_kg AS top_set_weight, tw.reps AS top_set_reps,
             tr.weight_kg AS rm_set_weight,  tr.reps AS rm_set_reps
      FROM agg a
      JOIN top_by_weight tw ON tw.date = a.date
      JOIN top_by_1rm tr    ON tr.date = a.date
      ORDER BY a.date ASC
    `,
    args: [exerciseId, userId],
  });
  return res.rows as unknown as ExerciseSessionStat[];
}

export async function getExerciseSetsHistory(userId: string, exerciseId: number, limit = 200): Promise<TrainingSet[]> {
  const res = await db.execute({
    sql: `
      SELECT ts.id, ts.exercise_id, e.name AS exercise_name,
             e.category_id, c.color AS category_color,
             ts.date, ts.weight_kg, ts.reps, ts.distance_m, ts.duration_seconds,
             ts.is_personal_record, ts.position
      FROM training_set ts
      JOIN exercise e ON e.id = ts.exercise_id
      JOIN category c ON c.id = e.category_id
      WHERE ts.exercise_id = ? AND ts.user_id = ?
      ORDER BY ts.date DESC, ts.id DESC
      LIMIT ?
    `,
    args: [exerciseId, userId, limit],
  });
  return res.rows as unknown as TrainingSet[];
}

export async function getWorkoutComment(userId: string, date: string): Promise<string | null> {
  const res = await db.execute({
    sql: 'SELECT body FROM workout_comment WHERE date = ? AND user_id = ?',
    args: [date, userId],
  });
  return (res.rows[0]?.body as string) ?? null;
}

export async function setWorkoutComment(userId: string, date: string, body: string): Promise<void> {
  if (!body.trim()) {
    await db.execute({
      sql: 'DELETE FROM workout_comment WHERE date = ? AND user_id = ?',
      args: [date, userId],
    });
    return;
  }
  await db.execute({
    sql: `INSERT INTO workout_comment (user_id, date, body) VALUES (?, ?, ?)
          ON CONFLICT(user_id, date) DO UPDATE SET body = excluded.body`,
    args: [userId, date, body],
  });
}

export function todayISO(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}
