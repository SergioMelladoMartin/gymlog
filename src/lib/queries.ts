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

export async function getCategories(): Promise<Category[]> {
  const res = await db.execute('SELECT id, name, color, sort_order FROM category ORDER BY sort_order, name');
  return res.rows as unknown as Category[];
}

export async function getExercises(): Promise<Exercise[]> {
  const res = await db.execute(`
    SELECT e.id, e.name, e.category_id, c.name AS category_name, c.color AS category_color,
           e.is_favorite,
           (SELECT MAX(date) FROM training_set WHERE exercise_id = e.id) AS last_used
    FROM exercise e
    JOIN category c ON c.id = e.category_id
    ORDER BY c.sort_order, e.name
  `);
  return res.rows as unknown as Exercise[];
}

/**
 * Shared CTEs resolving the current holder of each PR category:
 *   - pr_w_id   : heaviest weight ever for that exercise (1 set)
 *   - pr_1rm_id : best estimated 1RM (1 set)
 *   - pr_reps   : per exercise+weight bucket, the set with the highest reps.
 *                 Multiple sets can hold this badge (one per weight used).
 * Ties always break on earliest id — the set that first reached the mark keeps it.
 */
const PR_HOLDERS_CTE = `
  WITH pr_holders AS (
    SELECT e.id AS exercise_id,
      (SELECT id FROM training_set
       WHERE exercise_id = e.id
       ORDER BY weight_kg DESC, id ASC LIMIT 1) AS pr_w_id,
      (SELECT id FROM training_set
       WHERE exercise_id = e.id
       ORDER BY (weight_kg * (1.0 + reps / 30.0)) DESC, id ASC LIMIT 1) AS pr_1rm_id
    FROM exercise e
  ),
  pr_reps_holders AS (
    SELECT id, exercise_id
    FROM (
      SELECT id, exercise_id, weight_kg, reps,
             ROW_NUMBER() OVER (PARTITION BY exercise_id, weight_kg ORDER BY reps DESC, id ASC) AS rn
      FROM training_set
    ) t
    WHERE rn = 1
  )
`;

export async function getSetsForDate(date: string): Promise<TrainingSet[]> {
  const res = await db.execute({
    sql: `
      ${PR_HOLDERS_CTE}
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
      WHERE ts.date = ?
      ORDER BY ts.id ASC
    `,
    args: [date],
  });
  return res.rows as unknown as TrainingSet[];
}

export async function getDayPrCounts(dates: string[]): Promise<Map<string, DayPrCounts>> {
  const map = new Map<string, DayPrCounts>();
  if (!dates.length) return map;
  const placeholders = dates.map(() => '?').join(',');
  const res = await db.execute({
    sql: `
      ${PR_HOLDERS_CTE}
      SELECT ts.date,
             SUM(CASE WHEN ts.id = ph.pr_w_id   THEN 1 ELSE 0 END) AS pr_weight,
             SUM(CASE WHEN ts.id = ph.pr_1rm_id THEN 1 ELSE 0 END) AS pr_1rm,
             SUM(CASE WHEN prh.id IS NOT NULL   THEN 1 ELSE 0 END) AS pr_reps
      FROM training_set ts
      JOIN pr_holders ph ON ph.exercise_id = ts.exercise_id
      LEFT JOIN pr_reps_holders prh ON prh.id = ts.id
      WHERE ts.date IN (${placeholders})
      GROUP BY ts.date
    `,
    args: dates,
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

export async function getTrainingDaysInRange(from: string, to: string): Promise<TrainingDay[]> {
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
      WHERE ts.date BETWEEN ? AND ?
      GROUP BY ts.date
      ORDER BY ts.date ASC
    `,
    args: [from, to],
  });
  return res.rows as unknown as TrainingDay[];
}

export async function getExerciseById(id: number): Promise<Exercise | null> {
  const res = await db.execute({
    sql: `
      SELECT e.id, e.name, e.category_id, c.name AS category_name, c.color AS category_color,
             e.is_favorite, NULL AS last_used
      FROM exercise e
      JOIN category c ON c.id = e.category_id
      WHERE e.id = ?
    `,
    args: [id],
  });
  return (res.rows[0] as unknown as Exercise) ?? null;
}

export interface ExerciseSessionStat {
  date: string;
  top_weight: number;
  est_1rm: number;
  total_volume: number;
  set_count: number;
  /** Weight/reps of the top-weight set that day (tiebreak: higher reps). */
  top_set_weight: number;
  top_set_reps: number;
  /** Weight/reps of the set that produced the best 1RM that day. */
  rm_set_weight: number;
  rm_set_reps: number;
}

export async function getExerciseSessionStats(exerciseId: number): Promise<ExerciseSessionStat[]> {
  const res = await db.execute({
    sql: `
      WITH d AS (
        SELECT id, date, weight_kg, reps,
               weight_kg * (1.0 + reps / 30.0) AS est,
               weight_kg * reps                AS vol
        FROM training_set
        WHERE exercise_id = ?
      ),
      top_by_weight AS (
        SELECT date, weight_kg, reps
        FROM (
          SELECT date, weight_kg, reps,
                 ROW_NUMBER() OVER (PARTITION BY date ORDER BY weight_kg DESC, reps DESC, id ASC) AS rn
          FROM d
        ) t WHERE rn = 1
      ),
      top_by_1rm AS (
        SELECT date, weight_kg, reps
        FROM (
          SELECT date, weight_kg, reps,
                 ROW_NUMBER() OVER (PARTITION BY date ORDER BY est DESC, id ASC) AS rn
          FROM d
        ) t WHERE rn = 1
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
    args: [exerciseId],
  });
  return res.rows as unknown as ExerciseSessionStat[];
}

export async function getExerciseSetsHistory(exerciseId: number, limit = 200): Promise<TrainingSet[]> {
  const res = await db.execute({
    sql: `
      SELECT ts.id, ts.exercise_id, e.name AS exercise_name,
             e.category_id, c.color AS category_color,
             ts.date, ts.weight_kg, ts.reps, ts.distance_m, ts.duration_seconds,
             ts.is_personal_record, ts.position
      FROM training_set ts
      JOIN exercise e ON e.id = ts.exercise_id
      JOIN category c ON c.id = e.category_id
      WHERE ts.exercise_id = ?
      ORDER BY ts.date DESC, ts.id DESC
      LIMIT ?
    `,
    args: [exerciseId, limit],
  });
  return res.rows as unknown as TrainingSet[];
}

export async function getWorkoutComment(date: string): Promise<string | null> {
  const res = await db.execute({
    sql: 'SELECT body FROM workout_comment WHERE date = ?',
    args: [date],
  });
  return (res.rows[0]?.body as string) ?? null;
}

export async function setWorkoutComment(date: string, body: string): Promise<void> {
  if (!body.trim()) {
    await db.execute({ sql: 'DELETE FROM workout_comment WHERE date = ?', args: [date] });
    return;
  }
  await db.execute({
    sql: `INSERT INTO workout_comment (date, body) VALUES (?, ?)
          ON CONFLICT(date) DO UPDATE SET body = excluded.body`,
    args: [date, body],
  });
}

export function todayISO(): string {
  const d = new Date();
  const offsetMs = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 10);
}
